import { onMounted, onUnmounted } from "vue";
import { subscribeToProject } from "../services/sync";
import { refreshProjects } from "../store/projects";
import { realtimeInsertComment } from "../store/comments";
import { realtimeInsertMedia, realtimeUpdateMedia } from "../store/media";
import { realtimeInsertValidation } from "../store/validations";
import { realtimeUpdateStage } from "../store/stages";

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
      onComment: ({ eventType, new: row }) => {
        if (eventType === "INSERT" && row) {
          realtimeInsertComment(row);
        }
      },
      onMedia: ({ eventType, new: row }) => {
        if (eventType === "INSERT" && row) realtimeInsertMedia(row);
        if (eventType === "UPDATE" && row) realtimeUpdateMedia(row);
      },
      onValidation: ({ eventType, new: row }) => {
        if (eventType === "INSERT" && row) realtimeInsertValidation(row);
      },
      onStage: ({ eventType, new: row }) => {
        if ((eventType === "UPDATE" || eventType === "INSERT") && row) {
          realtimeUpdateStage(row);
        }
      },
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });
}
