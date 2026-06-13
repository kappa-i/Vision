import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { toast, syncError } from "./toast";
import { pickImage, generateThumb } from "../services/files";
import { uploadToR2, deleteFromR2, deleteFolderFromR2 } from "../services/r2";

/**
 * Liste des projets.
 * Source de vérité = Supabase cloud quand l'user est connecté.
 * SQLite local = cache de secours / opérations natives (chemins fichiers, etc.)
 */
export const STATUS = {
  DRAFT: "draft",
  REVISE: "revise",
  VALIDATED: "validated",
  DELIVERED: "delivered",
};

export const STATUS_LABEL = {
  [STATUS.DRAFT]: "En cours",
  [STATUS.REVISE]: "À revoir",
  [STATUS.VALIDATED]: "Validé",
  [STATUS.DELIVERED]: "Livré",
};

const state = reactive({
  items: [],
  loaded: false,
});

const seed = [
  {
    id: 1,
    name: "Campagne Été — Maison Lemaire",
    status: STATUS.DRAFT,
    description:
      "Campagne photo lifestyle pour la collection été. Ambiance solaire, tons chauds, 12 visuels retenus pour le web et l'affichage.",
  },
  { id: 2, name: "Shooting produit — Atelier Nord", status: STATUS.DRAFT, description: null },
  { id: 3, name: "Identité visuelle — Café Mire", status: STATUS.DELIVERED, description: null },
];

export const projects = state;

export async function loadProjects() {
  // Supabase (cloud) en priorité si connecté
  if (auth.user || !db.isTauri()) {
    try {
      const rows = await sync.syncFetchProjects();
      state.items = rows;
      state.loaded = true;
      return;
    } catch (e) {
      console.warn("Supabase fetch failed, falling back to SQLite:", e.message);
    }
  }
  // Fallback : SQLite local
  if (db.isTauri()) {
    state.items = await db.listProjects();
  } else if (!state.loaded) {
    state.items = [...seed];
  }
  state.loaded = true;
}

export async function addProject(name, description = null) {
  const trimmed = name.trim();
  const descTrimmed = description ? description.trim() : null;
  if (!trimmed) return;

  // Supabase
  if (auth.user || !db.isTauri()) {
    try {
      const row = await sync.syncCreateProject(trimmed, descTrimmed, auth.user.id);
      state.items.unshift(row);
      return;
    } catch (e) {
      toast(`Erreur Supabase : ${e.message}`, "error");
      console.error("addProject failed:", e);
    }
  }
  // Fallback local
  if (db.isTauri()) {
    const id = await db.createProject(trimmed, descTrimmed);
    state.items.unshift({ id, name: trimmed, status: STATUS.DRAFT, description: descTrimmed });
  } else {
    const id = Math.max(0, ...state.items.map((p) => p.id)) + 1;
    state.items.unshift({ id, name: trimmed, status: STATUS.DRAFT, description: descTrimmed });
  }
}

export function findProject(id) {
  return state.items.find((p) => String(p.id) === String(id));
}

export async function removeProject(id) {
  const p = findProject(id);
  const coverPath = p?.cover_path;

  state.items = state.items.filter((p) => String(p.id) !== String(id));

  // Purger R2 AVANT de supprimer la ligne projet : l'Edge Function vérifie
  // que le projet nous appartient encore (sinon → 403).
  if (auth.user) {
    await deleteFolderFromR2(`project_${id}/`);
    // Couverture héritée hors préfixe projet (anciens uploads dans covers/)
    if (coverPath && coverPath.startsWith("http") && !coverPath.includes(`project_${id}/`)) {
      await deleteFromR2(coverPath);
    }
  }

  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteProject(id); } catch (e) { syncError(e, "Suppression du projet"); }
  }
  if (db.isTauri()) await db.deleteProject(id);
}

/**
 * Quitter un projet (client) : retire sa propre ligne project_members.
 * Le projet original du créatif n'est PAS supprimé.
 */
export async function leaveProject(id) {
  state.items = state.items.filter((p) => String(p.id) !== String(id));
  if (auth.user) {
    try {
      await sync.syncLeaveProject(id, auth.user.id);
      toast("Vous avez quitté le projet.", "success");
    } catch (e) {
      syncError(e, "Sortie du projet");
    }
  }
}

export async function updateProjectStatus(id, status) {
  const p = findProject(id);
  if (p) p.status = status;
  if (auth.user || !db.isTauri()) {
    // RPC : seul moyen pour le client de changer le statut (RLS owner-only sur le reste)
    try { await sync.syncSetProjectStatus(id, status); } catch (e) { syncError(e, "Changement de statut"); }
  }
  if (db.isTauri()) await db.setProjectStatus(id, status);
}

export async function updateProjectMeta(id, name, description) {
  const p = findProject(id);
  const trimmed = (name || "").trim();
  if (p) {
    if (trimmed) p.name = trimmed;
    p.description = description;
  }
  if (auth.user || !db.isTauri()) {
    try {
      await sync.syncUpdateProject(id, { name: trimmed || p?.name, description });
    } catch (e) { syncError(e, "Modification du projet"); }
  }
  if (db.isTauri()) await db.updateProjectMeta(id, trimmed || p?.name, description);
}

// --- NOUVELLE IMPLEMENTATION ROBUSTE DE LA COUVERTURE ---
export async function setCover(id) {
  const p = findProject(id);
  if (!p) return;

  try {
    const path = await pickImage("Choisir une image de couverture");
    if (!path) return;

    toast("Traitement de l'image...", "info");
    
    // 1. Génération de la miniature locale (rapide)
    const thumbPath = await generateThumb(path);
    if (!thumbPath) throw new Error("Génération miniature impossible");

    // 2. Affichage instantané (réactivité Vue)
    p.cover_path = thumbPath;

    // 3. Sauvegarde SQLite (si on est dans Tauri)
    if (db.isTauri()) {
      await db.setProjectCover(id, thumbPath).catch(err => {
        console.warn("Erreur SQLite ignorée:", err);
      });
    }

    // 4. Si connecté, on upload vers Cloudflare R2
    if (auth.user) {
      toast("Envoi vers le cloud...", "info");
      const cloudUrl = await uploadToR2(thumbPath, `project_${id}/covers`);

      // 5. On ne pousse au cloud QUE l'URL R2 : un chemin local ne résoudrait
      // pas sur la machine du client (couverture cassée). Sans URL cloud,
      // la couverture reste visible localement mais n'est pas partagée.
      if (cloudUrl) {
        p.cover_path = cloudUrl;
        try {
          await sync.syncUpdateProject(id, { cover_path: cloudUrl });
        } catch (err) {
          console.warn("Supabase update refusé (RLS?) :", err.message);
        }
      } else {
        toast("Couverture enregistrée en local (envoi cloud indisponible).", "info");
      }
    }
    
    toast("Couverture définie avec succès !", "success");
  } catch (e) {
    console.error("Erreur setCover:", e);
    const msg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
    toast("Erreur: " + msg, "error");
  }
}
// --------------------------------------------------------

/** Recharge les projets depuis Supabase (utile après Realtime event). */
export async function refreshProjects() {
  if (auth.user || !db.isTauri()) {
    try {
      const rows = await sync.syncFetchProjects();
      // Ne pas écraser une cover_path locale par null si Supabase n'envoie rien
      state.items.forEach(p => {
        const row = rows.find(r => r.id === p.id);
        if (row && !row.cover_path && p.cover_path) {
          row.cover_path = p.cover_path;
        }
      });
      state.items = rows;
    } catch (e) { console.warn(e.message); }
  }
}
