import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { pickImages, pickImage, basename, isImagePath, generateThumb } from "../services/files";
import { uploadToR2, deleteFromR2 } from "../services/r2";
import { toast, syncError } from "./toast";

/**
 * Médias d'un projet — persistés sur Supabase + SQLite local.
 * Les fichiers images restent sur le disque local (paths absolus).
 * Supabase stocke les métadonnées (path, title, approval, etc.).
 */
const state = reactive({
  items: {},  // { `${projectId}:${kind}`: Media[] }
  loaded: {},
});

const key = (p, k) => `${p}:${k}`;

const seed = {
  "1:moodboard": [
    { id: 1, path: "https://picsum.photos/seed/mood1/600", title: "Ambiance lumière", starred: 0 },
    { id: 2, path: "https://picsum.photos/seed/mood2/600", title: "Palette chaude", starred: 0 },
    { id: 3, path: "https://picsum.photos/seed/mood3/600", title: "Cadrage serré", starred: 0 },
  ],
  "1:gallery": [
    { id: 11, path: "https://picsum.photos/seed/shot1/800/600", before_path: "https://picsum.photos/seed/shot1/800/600?grayscale", title: "Sélection 01", starred: 0 },
    { id: 12, path: "https://picsum.photos/seed/shot2/800/600", before_path: null, title: "Sélection 02", starred: 1 },
    { id: 13, path: "https://picsum.photos/seed/shot3/800/600", before_path: null, title: "Sélection 03", starred: 0 },
  ],
};

export const media = state;

export function mediaFor(projectId, kind) {
  return state.items[key(projectId, kind)] || [];
}

export async function loadMedia(projectId, kind) {
  const k = key(projectId, kind);
  if (state.loaded[k]) return;

  if (auth.user || !db.isTauri()) {
    try {
      const rows = await sync.syncFetchMedia(projectId, kind);
      state.items[k] = rows;
      state.loaded[k] = true;
      // Génère les miniatures manquantes en arrière-plan
      _generateMissingThumbs(state.items[k], projectId);
      return;
    } catch (e) { console.warn(e.message); }
  }

  if (db.isTauri()) {
    state.items[k] = await db.listMedia(projectId, kind);
    _generateMissingThumbs(state.items[k], projectId);
  } else {
    state.items[k] = [...(seed[k] || [])];
  }
  state.loaded[k] = true;
}

function _generateMissingThumbs(items, projectId) {
  (async () => {
    for (const m of items) {
      if (!m.thumb_path && m.path && !/^https?:\/\//.test(m.path)) {
        const thumbPath = await generateThumb(m.path);
        if (thumbPath) {
          db.setMediaThumb(m.id, thumbPath);
          m.thumb_path = thumbPath;
          // NB : on NE synchronise PAS le chemin local vers Supabase
          // (il ne résoudrait pas sur une autre machine). Seule l'URL R2
          // ci-dessous est poussée au cloud.
          uploadToR2(thumbPath, `project_${m.project_id ?? projectId}/thumbs`).then(async (remoteUrl) => {
            if (remoteUrl) {
              m.thumb_path = remoteUrl;
              if (auth.user || !db.isTauri()) {
                try { await sync.syncUpdateMedia(m.id, { thumb_path: remoteUrl }); } catch {}
              }
            }
          });
        }
      }
    }
  })();
}

export async function addPaths(projectId, kind, paths, targetAlbum = null) {
  const all = paths || [];
  const imgs = all.filter(isImagePath);
  if (imgs.length === 0) return 0;
  const k = key(projectId, kind);
  if (!state.items[k]) state.items[k] = [];
  for (const path of imgs) {
    const title = basename(path);
    const item = reactive({
      project_id: projectId,
      kind,
      path,
      before_path: null,
      thumb_path: /^https?:\/\//.test(path) ? path : null,
      title,
      starred: false,
      approval: null,
      album: targetAlbum,
      in_delivery: 0,
    });

    // Supabase
    if (auth.user || !db.isTauri()) {
      try {
        const row = await sync.syncCreateMedia({ project_id: projectId, kind, path, title, album: targetAlbum });
        item.id = row.id;
      } catch (e) { syncError(e, "Ajout de média"); }
    }
    // SQLite local
    if (!item.id && db.isTauri()) {
      item.id = await db.addMedia({ projectId, kind, path, title, album: targetAlbum });
    } else if (!item.id) {
      item.id = Math.max(0, ...state.items[k].map((m) => m.id || 0)) + 1;
    }

    state.items[k].push(item);
    
    // Upload de l'image originale
    uploadToR2(path, `project_${projectId}`).then(async (remoteUrl) => {
      if (remoteUrl) {
        item.path = remoteUrl;
        if (auth.user || !db.isTauri()) {
          try { await sync.syncUpdateMedia(item.id, { path: remoteUrl }); } catch {}
        }
      }
    });

    generateThumb(path).then(async (thumbPath) => {
      if (thumbPath) {
        if (db.isTauri()) db.setMediaThumb(item.id, thumbPath);
        item.thumb_path = thumbPath;
        // Affichage local instantané uniquement ; on ne pousse au cloud que
        // l'URL R2 (un chemin local ne résout pas sur une autre machine).

        // Upload miniature R2
        uploadToR2(thumbPath, `project_${projectId}/thumbs`).then(async (remoteThumbUrl) => {
          if (remoteThumbUrl) {
            item.thumb_path = remoteThumbUrl;
            if (auth.user || !db.isTauri()) {
               try { await sync.syncUpdateMedia(item.id, { thumb_path: remoteThumbUrl }); } catch {}
            }
          }
        });
      }
    });
  }
  return imgs.length;
}

export async function uploadMedia(projectId, kind) {
  const paths = await pickImages();
  return addPaths(projectId, kind, paths);
}

export async function setBefore(item) {
  const path = await pickImage("Choisir la photo ORIGINALE (avant retouche)");
  if (!path) return;
  item.before_path = path;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateMedia(item.id, { before_path: path }); } catch (e) { syncError(e, "Photo avant/après"); }
  }
  if (db.isTauri()) await db.setMediaBefore(item.id, path);
}

export async function clearBefore(item) {
  item.before_path = null;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateMedia(item.id, { before_path: null }); } catch (e) { syncError(e, "Photo avant/après"); }
  }
  if (db.isTauri()) await db.setMediaBefore(item.id, null);
}

export async function toggleFavorite(item) {
  item.starred = item.starred ? 0 : 1;
  if (auth.user || !db.isTauri()) {
    // RPC : le client ne peut toucher que starred (RLS owner-only sur le reste)
    try { await sync.syncSetMediaStarred(item.id, !!item.starred); } catch (e) { syncError(e, "Favori"); }
  }
  if (db.isTauri()) await db.setMediaFavorite(item.id, item.starred);
}

export async function setApproval(item, approval) {
  item.approval = item.approval === approval ? null : approval;
  if (auth.user || !db.isTauri()) {
    // RPC : le client ne peut toucher que approval (RLS owner-only sur le reste)
    try { await sync.syncSetMediaApproval(item.id, item.approval); } catch (e) { syncError(e, "Approbation"); }
  }
  if (db.isTauri()) await db.setMediaApproval(item.id, item.approval);
}

export async function setTitle(item, title) {
  item.title = title;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateMedia(item.id, { title }); } catch (e) { syncError(e, "Titre"); }
  }
  if (db.isTauri()) await db.setMediaTitle(item.id, title);
}

export async function setAlbum(item, album) {
  item.album = album?.trim() || null;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateMedia(item.id, { album: item.album }); } catch (e) { syncError(e, "Album"); }
  }
  if (db.isTauri()) await db.setMediaAlbum(item.id, item.album);
}

export async function setInDelivery(item, value) {
  item.in_delivery = value ? 1 : 0;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateMedia(item.id, { in_delivery: item.in_delivery }); } catch (e) { syncError(e, "Sélection de livraison"); }
  }
  if (db.isTauri()) await db.setMediaInDelivery(item.id, item.in_delivery);
}

export async function removeMedia(projectId, kind, item) {
  const k = key(projectId, kind);
  state.items[k] = (state.items[k] || []).filter((m) => m.id !== item.id);
  
  // Suppression depuis Cloudflare R2
  if (item.path && item.path.startsWith("http")) deleteFromR2(item.path);
  if (item.thumb_path && item.thumb_path.startsWith("http")) deleteFromR2(item.thumb_path);

  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteMedia(item.id); } catch (e) { syncError(e, "Suppression de média"); }
  }
  if (db.isTauri()) await db.deleteMedia(item.id);
}

/** Pousse un nouveau média reçu via Realtime. */
export function realtimeInsertMedia(row) {
  const k = key(row.project_id, row.kind);
  if (!state.items[k]) state.items[k] = [];
  const exists = state.items[k].find((m) => m.id === row.id);
  if (!exists) state.items[k].push(row);
}

/** Met à jour un média reçu via Realtime. */
export function realtimeUpdateMedia(row) {
  const k = key(row.project_id, row.kind);
  if (!state.items[k]) return;
  const idx = state.items[k].findIndex((m) => m.id === row.id);
  if (idx !== -1) Object.assign(state.items[k][idx], row);
}

export async function reorderMedia(projectId, kind, mediaIds) {
  const k = key(projectId, kind);
  if (!state.items[k]) return;

  const updates = [];
  mediaIds.forEach((id, index) => {
    const item = state.items[k].find(m => String(m.id) === String(id));
    if (item && item.position !== index) {
      item.position = index;
      updates.push({ id: item.id, position: index });
    }
  });

  if (updates.length > 0) {
    if (auth.user || !db.isTauri()) {
      try {
        await Promise.all(updates.map(u => sync.syncUpdateMedia(u.id, { position: u.position })));
      } catch (e) { console.warn(e.message); }
    }
    if (db.isTauri()) {
      await db.updateMediaPositions(updates);
    }
  }
}
