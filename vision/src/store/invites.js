import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";

/**
 * Invitations client — persistées sur Supabase + SQLite local.
 * Le code d'invitation reste un code court lisible (6 chars).
 * Après rachat, on lie l'user à son projet via project_members.
 */
const state = reactive({
  byProject: {},
  loaded: {},
});

export const invites = state;

export function invitesFor(projectId) {
  return state.byProject[projectId] || [];
}

export function activeInvite(projectId) {
  const list = state.byProject[projectId] || [];
  return list[0] || null;
}

function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
  return c;
}

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function loadInvites(projectId) {
  if (state.loaded[projectId]) return;
  if (auth.user || !db.isTauri()) {
    try {
      state.byProject[projectId] = await sync.syncFetchInvites(projectId);
      state.loaded[projectId] = true;
      return;
    } catch (e) { console.warn(e.message); }
  }
  state.byProject[projectId] = db.isTauri() ? await db.listInvites(projectId) : [];
  state.loaded[projectId] = true;
}

export async function createInvite(projectId, email = null) {
  const code = genCode();
  const invite = {
    project_id: projectId,
    code,
    email,
    created_at: nowStamp(),
    accepted_at: null,
  };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateInvite({ project_id: projectId, code, email });
      invite.id = row.id;
    } catch (e) { console.warn(e.message); }
  }
  if (!invite.id && db.isTauri()) {
    invite.id = await db.createInvite({ projectId, code, email });
  } else if (!invite.id) {
    const list = state.byProject[projectId] || [];
    invite.id = Math.max(0, ...list.map((i) => i.id || 0)) + 1;
  }

  if (!state.byProject[projectId]) state.byProject[projectId] = [];
  state.byProject[projectId].unshift(invite);
  return invite;
}

export async function removeInvite(projectId, id) {
  state.byProject[projectId] = (state.byProject[projectId] || []).filter((i) => i.id !== id);
  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteInvite(id); } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) await db.deleteInvite(id);
}

export async function regenerateInvite(projectId) {
  const current = activeInvite(projectId);
  if (current && !current.accepted_at) {
    await removeInvite(projectId, current.id);
  }
  return createInvite(projectId);
}

/**
 * Recherche un code et le marque accepté.
 * Si l'user est connecté → lie son compte au projet via project_members.
 */
export async function redeemCode(rawCode) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;

  // Supabase
  if (auth.user || !db.isTauri()) {
    try {
      const invite = await sync.syncFindInviteByCode(code);
      if (!invite) return null;
      if (!invite.accepted_at) {
        await sync.syncAcceptInvite(invite.id);
        invite.accepted_at = new Date().toISOString();
      }
      // Lie l'user au projet
      await sync.syncAddProjectMember(invite.project_id, auth.user.id);
      return invite;
    } catch (e) { console.warn(e.message); }
  }

  // Fallback Tauri
  if (db.isTauri()) {
    const invite = await db.findInviteByCode(code);
    if (!invite) return null;
    if (!invite.accepted_at) await db.acceptInvite(invite.id, nowStamp());
    return invite;
  }

  // Mode navigateur demo
  for (const list of Object.values(state.byProject)) {
    const found = list.find((i) => i.code === code);
    if (found) {
      found.accepted_at = found.accepted_at || nowStamp();
      return found;
    }
  }
  return null;
}
