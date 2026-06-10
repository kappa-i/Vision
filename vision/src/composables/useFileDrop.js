import { ref, onMounted, onUnmounted } from "vue";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isTauri } from "../services/db";

/**
 * Glisser-déposer de fichiers depuis l'explorateur.
 *
 * Dans Tauri, le `drop` HTML classique ne reçoit pas les fichiers : la webview
 * intercepte le drop et l'expose via un événement natif qui fournit les
 * CHEMINS des fichiers — exactement ce dont notre modèle a besoin.
 *
 * `onDrop(paths)` est appelé au lâcher ; `isDragging` pilote le surlignage.
 */
export function useFileDrop(onDrop) {
  const isDragging = ref(false);
  let unlisten = null;

  onMounted(async () => {
    if (!isTauri()) return;
    try {
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        const t = event.payload.type;
        if (t === "enter" || t === "over") {
          isDragging.value = true;
        } else if (t === "leave") {
          isDragging.value = false;
        } else if (t === "drop") {
          isDragging.value = false;
          onDrop(event.payload.paths || []);
        }
      });
    } catch {
      /* API indisponible */
    }
  });

  onUnmounted(() => {
    if (unlisten) unlisten();
  });

  return { isDragging };
}
