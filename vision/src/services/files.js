import { open, save } from "@tauri-apps/plugin-dialog";
import { copyFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isTauri } from "./db";

/**
 * Sélection et affichage de fichiers images.
 * - `pickImages` ouvre le dialog natif (Tauri uniquement).
 * - `assetUrl` transforme un chemin local en URL servable par la webview
 *   via le protocole asset (cf. tauri.conf.json > security.assetProtocol).
 */
export async function pickImages() {
  if (!isTauri()) return [];
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"],
      },
    ],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickImage(title) {
  if (!isTauri()) return null;
  const selected = await open({
    multiple: false,
    title,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export function assetUrl(path) {
  if (!path) return "";
  // Jeu de démo navigateur : URLs distantes affichées telles quelles
  if (/^https?:\/\//.test(path)) return path;
  return convertFileSrc(path);
}

export function basename(path) {
  if (!path) return "";
  return path.split(/[\\/]/).pop();
}

/** Télécharge tous les fichiers vers un dossier choisi. Renvoie { dir, count } ou null. */
export async function downloadAll(paths) {
  if (!isTauri() || !paths.length) return null;
  const dir = await open({ directory: true, title: "Choisir le dossier de destination" });
  if (!dir) return null;
  let count = 0;
  for (const src of paths) {
    try {
      await copyFile(src, `${dir}/${basename(src)}`);
      count++;
    } catch {
      /* ignore les échecs individuels */
    }
  }
  return { dir, count };
}

/**
 * Génère une miniature 500px via la commande Rust.
 * Retourne le chemin de la miniature, ou null en cas d'échec.
 */
export async function generateThumb(path) {
  if (!isTauri() || !path) return null;
  try {
    return await invoke("generate_thumb", { path });
  } catch {
    return null;
  }
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"];

export function isImagePath(path) {
  if (!path) return false;
  if (/^https?:\/\//.test(path)) return true; // Web URLs are pre-filtered in drop/paste handlers
  const cleanPath = path.split("?")[0];
  const ext = cleanPath.split(".").pop()?.toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

/**
 * Télécharge un livrable : demande où l'enregistrer puis copie le fichier.
 * Renvoie le chemin de destination, ou null si annulé / hors Tauri.
 */
export async function downloadFile(srcPath) {
  if (!isTauri()) return null;
  const destination = await save({ defaultPath: basename(srcPath) });
  if (!destination) return null;
  await copyFile(srcPath, destination);
  return destination;
}
