import { reactive, readonly, computed } from "vue";
import { auth } from "../services/auth";

/**
 * Session locale — qui utilise l'app de ce côté ?
 *
 * Le rôle est désormais une conséquence de l'identité, pas un choix manuel :
 *  - Le créatif = propriétaire du projet (owner_id === auth.user.id)
 *  - Le client   = membre invité (project_members)
 *
 * En pratique, le rôle est résolu par projet dans les stores/pages.
 * Pour les permissions globales (créer un projet, etc.), on distingue
 * par un flag `joinedProjectId` : null = créatif, sinon = client invité.
 *
 * Le RoleSwitcher est supprimé ; setRole() n'est plus exposé dans l'UI.
 */
export const ROLES = {
  CREATIF: "creatif",
  CLIENT: "client",
};

const state = reactive({
  role: ROLES.CREATIF,
  joinedProjectId: null, // project_id si l'user a rejoint via un code
});

/** Appelé après qu'un client a racheté un code d'invitation. */
export function joinProjectAsClient(projectId) {
  state.role = ROLES.CLIENT;
  state.joinedProjectId = projectId;
}

/** Appelé quand un créatif ouvre son propre projet. */
export function openAsCreatif() {
  state.role = ROLES.CREATIF;
  state.joinedProjectId = null;
}

export const session = readonly(state);

// Identité courante — exposée pour l'UI
export const currentUser = computed(() => auth.user);
export const currentProfile = computed(() => auth.profile);

// Capacités dérivées du rôle
export const can = {
  createProject: computed(() => state.role === ROLES.CREATIF),
  invite: computed(() => state.role === ROLES.CREATIF),
  uploadMedia: computed(() => state.role === ROLES.CREATIF),
  editMoodboard: computed(() => state.role === ROLES.CREATIF),
  comment: computed(() => true),
  validate: computed(() => state.role === ROLES.CLIENT),
  viewTimeline: computed(() => true),
};
