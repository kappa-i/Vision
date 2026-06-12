import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { STATUS, updateProjectStatus } from "./projects";
import { syncError } from "./toast";

/**
 * Validation client — persistée sur Supabase + SQLite local.
 */
const state = reactive({
  byProject: {},
  loaded: {},
});

export const validations = state;

export function validationsFor(projectId) {
  return state.byProject[projectId] || [];
}

export function currentDecision(projectId) {
  const list = state.byProject[projectId] || [];
  return list.length ? list[0].decision : null;
}

export async function loadValidations(projectId) {
  if (state.loaded[projectId]) return;
  if (auth.user || !db.isTauri()) {
    try {
      state.byProject[projectId] = await sync.syncFetchValidations(projectId);
      state.loaded[projectId] = true;
      return;
    } catch (e) { console.warn(e.message); }
  }
  state.byProject[projectId] = db.isTauri() ? await db.listValidations(projectId) : [];
  state.loaded[projectId] = true;
}

export async function decide(projectId, decision) {
  const entry = {
    project_id: projectId,
    decision,
    created_at: new Date().toISOString(),
  };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateValidation(projectId, decision);
      entry.id = row.id;
    } catch (e) { syncError(e, "Validation"); }
  }
  if (!entry.id && db.isTauri()) {
    entry.id = await db.addValidation(projectId, decision);
  } else if (!entry.id) {
    const list = state.byProject[projectId] || [];
    entry.id = Math.max(0, ...list.map((v) => v.id || 0)) + 1;
  }

  if (!state.byProject[projectId]) state.byProject[projectId] = [];
  state.byProject[projectId].unshift(entry);

  await updateProjectStatus(
    projectId,
    decision === "approved" ? STATUS.VALIDATED : STATUS.REVISE
  );
}

/** Pousse une validation reçue via Realtime. */
export function realtimeInsertValidation(row) {
  if (!state.byProject[row.project_id]) state.byProject[row.project_id] = [];
  const exists = state.byProject[row.project_id].find((v) => v.id === row.id);
  if (!exists) state.byProject[row.project_id].unshift(row);
}
