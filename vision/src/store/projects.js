import { reactive } from "vue";
import * as db from "../services/db";
import * as sync from "../services/sync";
import { auth } from "../services/auth";
import { toast } from "./toast";
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

  // Supprimer la couverture de Cloudflare
  if (coverPath && coverPath.startsWith("http")) {
    deleteFromR2(coverPath);
  }

  // Supprimer tout le dossier du projet de Cloudflare
  deleteFolderFromR2(`project_${id}/`);

  if (auth.user || !db.isTauri()) {
    try { await sync.syncDeleteProject(id); } catch (e) { console.warn(e.message); }
  }
  if (db.isTauri()) await db.deleteProject(id);
}

export async function updateProjectStatus(id, status) {
  const p = findProject(id);
  if (p) p.status = status;
  if (auth.user || !db.isTauri()) {
    try { await sync.syncUpdateProject(id, { status }); } catch (e) { console.warn(e.message); }
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
    } catch (e) { console.warn(e.message); }
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
      const cloudUrl = await uploadToR2(thumbPath, "covers");
      
      // 5. Mise à jour Supabase via syncUpdateProject (avec try/catch interne pour ignorer RLS)
      const finalPath = cloudUrl || thumbPath; 
      
      try {
        await sync.syncUpdateProject(id, { cover_path: finalPath });
        if (cloudUrl) {
          // Si réussi, on garde l'URL cloud en local
          p.cover_path = cloudUrl;
        }
      } catch (err) {
        console.warn("Supabase update refusé (RLS?) :", err.message);
        // L'image reste visible localement, on ignore l'erreur
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
