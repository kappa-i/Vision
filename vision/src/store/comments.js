import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { syncError } from "./toast";

/**
 * Commentaires / feedback — persistés sur Supabase (cloud) + SQLite (cache local).
 */
const state = reactive({
  byProject: {},
  loaded: {},
  byMedia: {},
  mediaLoaded: {},
  unresolved: {},
});

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

const seed = {
  1: [
    { id: 1, project_id: 1, media_id: null, author: "creatif", body: "Voici la direction artistique proposée pour la campagne été.", created_at: "2026-06-01 10:12:00" },
    { id: 2, project_id: 1, media_id: null, author: "client", body: "J'adore l'ambiance. On peut réchauffer un peu les tons ?", created_at: "2026-06-01 14:30:00" },
  ],
};

export const comments = state;

export function commentsFor(projectId) {
  return state.byProject[projectId] || [];
}

export async function loadComments(projectId) {
  if (state.loaded[projectId]) return;
  if (auth.user || !db.isTauri()) {
    try {
      state.byProject[projectId] = await sync.syncFetchComments(projectId);
      state.loaded[projectId] = true;
      return;
    } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) {
    state.byProject[projectId] = await db.listComments(projectId);
  } else {
    state.byProject[projectId] = [...(seed[projectId] || [])];
  }
  state.loaded[projectId] = true;
}

export async function addComment(projectId, author, body) {
  const trimmed = body.trim();
  if (!trimmed) return;

  const optimistic = {
    project_id: projectId,
    media_id: null,
    author,
    body: trimmed,
    created_at: nowStamp(),
  };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateComment({ project_id: projectId, media_id: null, author, body: trimmed });
      optimistic.id = row.id;
    } catch (e) { syncError(e, "Commentaire"); }
  }
  if (!optimistic.id && db.isTauri()) {
    optimistic.id = await db.addComment({ projectId, author, body: trimmed });
  } else if (!optimistic.id) {
    const list = state.byProject[projectId] || [];
    optimistic.id = Math.max(0, ...list.map((c) => c.id)) + 1;
  }

  if (!state.byProject[projectId]) state.byProject[projectId] = [];
  state.byProject[projectId].push(optimistic);
}

// --- Commentaires & annotations au niveau d'une image ---

export function imageCommentsFor(mediaId) {
  return state.byMedia[mediaId] || [];
}

export async function loadImageComments(mediaId) {
  if (state.mediaLoaded[mediaId]) return;
  if (auth.user || !db.isTauri()) {
    try {
      state.byMedia[mediaId] = await sync.syncFetchImageComments(mediaId);
      state.mediaLoaded[mediaId] = true;
      return;
    } catch (e) { console.warn(e.message); }
  }
  state.byMedia[mediaId] = db.isTauri() ? await db.listImageComments(mediaId) : [];
  state.mediaLoaded[mediaId] = true;
}

export async function addImageComment(projectId, mediaId, author, body, x = null, y = null) {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const c = {
    project_id: projectId,
    media_id: mediaId,
    author,
    body: trimmed,
    x,
    y,
    resolved: false,
    created_at: nowStamp(),
  };

  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateComment({ project_id: projectId, media_id: mediaId, author, body: trimmed, x, y });
      c.id = row.id;
    } catch (e) { syncError(e, "Annotation"); }
  }
  if (!c.id && db.isTauri()) {
    c.id = await db.addComment({ projectId, author, body: trimmed, mediaId, x, y });
  } else if (!c.id) {
    const list = state.byMedia[mediaId] || [];
    c.id = Math.max(0, ...list.map((i) => i.id || 0)) + 1;
  }

  if (!state.byMedia[mediaId]) state.byMedia[mediaId] = [];
  state.byMedia[mediaId].push(c);
  return c;
}

export async function removeComment(projectId, id) {
  state.byProject[projectId] = (state.byProject[projectId] || []).filter((c) => c.id !== id);
  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteComment(id); } catch (e) { syncError(e, "Suppression de commentaire"); }
  }
  if (db.isTauri()) await db.deleteComment(id);
}

export async function removeImageComment(mediaId, id) {
  state.byMedia[mediaId] = (state.byMedia[mediaId] || []).filter((c) => c.id !== id);
  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteComment(id); } catch (e) { syncError(e, "Suppression d'annotation"); }
  }
  if (db.isTauri()) await db.deleteComment(id);
}

export async function toggleResolved(mediaId, comment) {
  comment.resolved = comment.resolved ? 0 : 1;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateComment(comment.id, { resolved: !!comment.resolved }); } catch (e) { syncError(e, "Résolution d'annotation"); }
  }
  if (db.isTauri()) await db.setCommentResolved(comment.id, comment.resolved);
}

export function unresolvedFor(projectId) {
  return state.unresolved[projectId] || [];
}

export async function loadUnresolvedAnnotations(projectId) {
  if (!db.isTauri()) return;
  state.unresolved[projectId] = await db.listUnresolvedAnnotationsByProject(projectId);
}

/** Pousse un nouveau commentaire reçu via Realtime dans le store local. */
export function realtimeInsertComment(row) {
  if (row.media_id) {
    if (!state.byMedia[row.media_id]) state.byMedia[row.media_id] = [];
    const exists = state.byMedia[row.media_id].find((c) => c.id === row.id);
    if (!exists) state.byMedia[row.media_id].push(row);
  } else {
    if (!state.byProject[row.project_id]) state.byProject[row.project_id] = [];
    const exists = state.byProject[row.project_id].find((c) => c.id === row.id);
    if (!exists) state.byProject[row.project_id].push(row);
  }
}
