import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { syncError } from "./toast";

/**
 * Invitations client — persistées sur Supabase + SQLite local.
 * Le code court (6 chars) expire après 72 h et est à usage unique.
 * Le rachat passe par la RPC `redeem_invite` (la table invites n'est
 * pas lisible par les clients — anti-énumération).
 */
const state = reactive({
  byProject: {},
  loaded: {},
});

export const invites = state;

const INVITE_TTL_HOURS = 72;

export function invitesFor(projectId) {
  return state.byProject[projectId] || [];
}

export function activeInvite(projectId) {
  const list = state.byProject[projectId] || [];
  return list[0] || null;
}

export function isExpired(invite) {
  if (!invite?.expires_at) return false;
  return new Date(invite.expires_at).getTime() < Date.now();
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
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();
  const invite = {
    project_id: projectId,
    code,
    email,
    created_at: nowStamp(),
    accepted_at: null,
    expires_at: expiresAt,
  };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateInvite({
        project_id: projectId,
        code,
        email,
        expires_at: expiresAt,
      });
      invite.id = row.id;
    } catch (e) { syncError(e, "Invitation"); }
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
    try { await sync.syncDeleteInvite(id); } catch (e) { syncError(e, "Suppression d'invitation"); }
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
 * Rachat d'un code via la RPC serveur (validation existence + expiration +
 * usage unique). Renvoie { ok, project_id } ou { ok: false, error }.
 */
export async function redeemCode(rawCode) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Entrez un code." };

  // Supabase (chemin normal)
  if (auth.user) {
    try {
      const res = await sync.syncRedeemInvite(code);
      return res || { ok: false, error: "Code invalide ou introuvable." };
    } catch (e) {
      console.warn(e.message);
      return { ok: false, error: "Erreur réseau, réessayez." };
    }
  }

  // Fallback local (hors-ligne / démo)
  if (db.isTauri()) {
    const invite = await db.findInviteByCode(code);
    if (!invite) return { ok: false, error: "Code invalide ou introuvable." };
    if (!invite.accepted_at) await db.acceptInvite(invite.id, nowStamp());
    return { ok: true, project_id: invite.project_id };
  }

  return { ok: false, error: "Code invalide ou introuvable." };
}
