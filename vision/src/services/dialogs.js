import { reactive } from "vue";

/**
 * Confirmation utilisateur, rendue par <ConfirmDialog /> (monté dans App.vue)
 * dans la direction artistique de l'app. Remplace les popups système :
 * sous Tauri, `window.confirm` est asynchrone (toujours vrai dans un `if`)
 * et exige une permission dialog.
 *
 * Usage : `if (await confirmDialog("Supprimer ?")) { … }`
 */
const state = reactive({
  open: false,
  title: "Confirmer",
  message: "",
  confirmLabel: "Confirmer",
  cancelLabel: "Annuler",
});

let resolver = null;

export const confirmState = state;

export function confirmDialog(message, options = {}) {
  state.message = message;
  state.title = options.title || "Confirmer";
  state.confirmLabel = options.confirmLabel || "Confirmer";
  state.cancelLabel = options.cancelLabel || "Annuler";
  state.open = true;
  return new Promise((resolve) => {
    resolver = resolve;
  });
}

export function resolveConfirm(value) {
  state.open = false;
  resolver?.(value);
  resolver = null;
}
