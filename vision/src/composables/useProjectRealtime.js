import { onMounted, onUnmounted } from "vue";
import { subscribeToProject } from "../services/sync";
import { refreshProjects } from "../store/projects";
import { realtimeInsertComment, realtimeUpdateComment, realtimeDeleteComment } from "../store/comments";
import { realtimeInsertMedia, realtimeUpdateMedia, realtimeDeleteMedia } from "../store/media";
import { realtimeInsertValidation } from "../store/validations";

/**
 * Souscrit au canal Realtime d'un projet et met à jour les stores locaux
 * dès qu'un autre utilisateur (sur une autre machine) fait une modification.
 *
 * Usage : appeler dans le <script setup> d'une page projet.
 *   useProjectRealtime(projectId)
 */
export function useProjectRealtime(projectId) {
  let unsubscribe = null;

  onMounted(() => {
    unsubscribe = subscribeToProject(projectId, {
      onProject: ({ eventType, new: row }) => {
        if (eventType === "UPDATE" || eventType === "INSERT") {
          refreshProjects();
        }
      },
      onComment: ({ eventType, new: row, old }) => {
        if (eventType === "INSERT" && row) realtimeInsertComment(row);
        else if (eventType === "UPDATE" && row) realtimeUpdateComment(row);
        else if (eventType === "DELETE" && old) realtimeDeleteComment(old);
      },
      onMedia: ({ eventType, new: row, old }) => {
        if (eventType === "INSERT" && row) realtimeInsertMedia(row);
        else if (eventType === "UPDATE" && row) realtimeUpdateMedia(row);
        else if (eventType === "DELETE" && old) realtimeDeleteMedia(old);
      },
      onValidation: ({ eventType, new: row }) => {
        if (eventType === "INSERT" && row) realtimeInsertValidation(row);
      },
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
}
