import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";

/**
 * Timeline projet — étapes persistées sur Supabase + SQLite local.
 */
export const DEFAULT_STAGES = ["Brief", "Shoot", "Sélection", "Retouche", "Livraison"];

const state = reactive({
  byProject: {},
  loaded: {},
});

export const stages = state;

export function stagesFor(projectId) {
  return state.byProject[projectId] || [];
}

function nowStamp() {
  return new Date().toISOString();
}

async function _seedDefaultStages(projectId) {
  const seeded = [];
  for (let i = 0; i < DEFAULT_STAGES.length; i++) {
    const fields = {
      project_id: projectId,
      label: DEFAULT_STAGES[i],
      position: i,
      status: i === 0 ? "current" : "todo",
    };
    let id;
    if (auth.user || !db.isTauri()) {
      try {
        const row = await sync.syncCreateStage(fields);
        id = row.id;
      } catch (e) { console.warn(e.message); }
    }
    if (!id && db.isTauri()) {
      id = await db.insertStage({ projectId, ...fields });
    } else if (!id) {
      id = i + 1;
    }
    seeded.push({ id, ...fields, reached_at: null });
  }
  return seeded;
}

export async function loadStages(projectId) {
  if (state.loaded[projectId]) return;

  if (auth.user || !db.isTauri()) {
    try {
      let rows = await sync.syncFetchStages(projectId);
      if (rows.length === 0) {
        rows = await _seedDefaultStages(projectId);
      }
      state.byProject[projectId] = rows;
      state.loaded[projectId] = true;
      return;
    } catch (e) { console.warn(e.message); }
  }

  if (db.isTauri()) {
    let rows = await db.listStages(projectId);
    if (rows.length === 0) {
      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        await db.insertStage({ projectId, label: DEFAULT_STAGES[i], position: i, status: i === 0 ? "current" : "todo" });
      }
      rows = await db.listStages(projectId);
    }
    state.byProject[projectId] = rows;
  } else {
    state.byProject[projectId] = DEFAULT_STAGES.map((label, i) => ({
      id: i + 1,
      project_id: projectId,
      label,
      position: i,
      status: i === 0 ? "done" : i === 1 ? "current" : "todo",
      reached_at: i <= 1 ? "2026-06-02T09:00:00Z" : null,
    }));
  }
  state.loaded[projectId] = true;
}

export async function setCurrentStage(projectId, stageId) {
  const list = state.byProject[projectId] || [];
  const target = list.find((s) => s.id === stageId);
  if (!target) return;

  for (const s of list) {
    let status;
    if (s.position < target.position) status = "done";
    else if (s.position === target.position) status = "current";
    else status = "todo";

    if (s.status !== status) {
      s.status = status;
      if (status !== "todo" && !s.reached_at) s.reached_at = nowStamp();
      if (status === "todo") s.reached_at = null;
      const fields = { status: s.status, reached_at: s.reached_at };
      if (auth.user || !db.isTauri()) {
        try { await sync.syncUpdateStage(s.id, fields); } catch (e) { console.warn(e.message); }
      }
      if (db.isTauri()) await db.updateStage(s.id, s.status, s.reached_at);
    }
  }
}

export async function renameStage(projectId, stageId, label) {
  const s = (state.byProject[projectId] || []).find((s) => s.id === stageId);
  if (!s) return;
  s.label = label;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateStage(stageId, { label }); } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) await db.updateStageLabel(stageId, label);
}

export async function setStageDate(projectId, stageId, dateStr) {
  const s = (state.byProject[projectId] || []).find((s) => s.id === stageId);
  if (!s) return;
  s.reached_at = dateStr ? `${dateStr}T00:00:00Z` : null;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateStage(stageId, { reached_at: s.reached_at }); } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) await db.setStageDate(stageId, s.reached_at);
}

export async function addStage(projectId, label = "Nouvelle étape") {
  const list = state.byProject[projectId] || [];
  const position = list.length ? Math.max(...list.map((s) => s.position)) + 1 : 0;
  const stage = { project_id: projectId, label, position, status: "todo", reached_at: null };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateStage(stage);
      stage.id = row.id;
    } catch (e) { console.warn(e.message); }
  }
  if (!stage.id && db.isTauri()) {
    stage.id = await db.insertStage({ projectId, label, position, status: "todo" });
  } else if (!stage.id) {
    stage.id = Math.max(0, ...list.map((s) => s.id || 0)) + 1;
  }

  if (!state.byProject[projectId]) state.byProject[projectId] = [];
  state.byProject[projectId].push(stage);
}

export async function removeStage(projectId, stageId) {
  state.byProject[projectId] = (state.byProject[projectId] || []).filter((s) => s.id !== stageId);
  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteStage(stageId); } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) await db.deleteStage(stageId);
}

/** Met à jour une étape reçue via Realtime. */
export function realtimeUpdateStage(row) {
  const list = state.byProject[row.project_id] || [];
  const idx = list.findIndex((s) => s.id === row.id);
  if (idx !== -1) Object.assign(list[idx], row);
  else list.push(row);
}
