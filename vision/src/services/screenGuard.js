import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./db";

/**
 * Protection capture d'écran GLOBALE.
 *
 * Active la « content protection » de l'OS sur la fenêtre : sur Windows,
 * l'app est exclue des captures (apparaît NOIRE dans screenshots et
 * enregistrements). La vue en direct reste normale pour l'utilisateur.
 *
 * Appelée une fois au démarrage (App.vue). Pour désactiver : ne pas
 * l'appeler, ou passer `true` → `false` ci-dessous.
 */
export async function setScreenProtection(enabled) {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().setContentProtected(enabled);
  } catch {
    /* API indisponible — on échoue silencieusement */
  }
}

// Conservés pour compatibilité (no-op) : la protection est désormais globale.
export function acquireScreenGuard() {}
export function releaseScreenGuard() {}
