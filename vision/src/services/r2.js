import { readFile } from "@tauri-apps/plugin-fs";
import { supabase } from "./supabase";
import { basename } from "./files";

/**
 * Stockage médias Cloudflare R2 — via l'Edge Function `r2-sign`.
 *
 * Aucune clé R2 dans l'app : la fonction serveur vérifie l'identité
 * (et la propriété du projet), puis délivre une URL d'upload présignée
 * ou exécute la suppression elle-même.
 *
 * Tous les objets vivent sous `project_<id>/…` (originaux),
 * `project_<id>/thumbs/…` et `project_<id>/covers/…` — ce qui permet
 * de purger un projet entier avec un seul préfixe.
 */

async function signRequest(body) {
  const { data, error } = await supabase.functions.invoke("r2-sign", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function contentTypeFor(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "image/jpeg";
}

/**
 * Upload d'un fichier local vers R2.
 * `folder` doit être `project_<id>`, `project_<id>/thumbs` ou `project_<id>/covers`.
 * Renvoie l'URL publique, ou null en cas d'échec.
 */
export async function uploadToR2(localPath, folder) {
  if (!localPath || !folder) return null;
  if (/^https?:\/\//.test(localPath)) return null;

  try {
    const fileName = basename(localPath);
    const contentType = contentTypeFor(fileName);

    const { uploadUrl, publicUrl } = await signRequest({
      action: "upload-url",
      folder,
      filename: fileName,
      contentType,
    });

    const fileData = await readFile(localPath);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: fileData,
      headers: { "Content-Type": contentType },
    });
    if (!res.ok) throw new Error(`Upload R2 refusé (HTTP ${res.status})`);

    return publicUrl;
  } catch (error) {
    console.error("Erreur upload R2:", error);
    return null;
  }
}

/** Supprime un objet R2 à partir de son URL. */
export async function deleteFromR2(url) {
  if (!url || !url.startsWith("http")) return false;
  try {
    const { ok } = await signRequest({ action: "delete", url });
    return !!ok;
  } catch (error) {
    console.error("Erreur suppression R2:", error);
    return false;
  }
}

/** Supprime tous les objets d'un projet (préfixe `project_<id>/`). */
export async function deleteFolderFromR2(folderPrefix) {
  if (!folderPrefix) return false;
  try {
    const { ok } = await signRequest({ action: "delete-folder", prefix: folderPrefix });
    return !!ok;
  } catch (error) {
    console.error("Erreur suppression dossier R2:", error);
    return false;
  }
}
