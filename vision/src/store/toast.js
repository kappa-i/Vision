import { reactive } from "vue";

/** Petites notifications éphémères (succès, info, erreur). */
const state = reactive({ items: [] });
let seq = 0;

export const toasts = state;

export function toast(message, type = "info") {
  const t = { id: ++seq, message, type };
  state.items.push(t);
  setTimeout(() => dismiss(t.id), 3200);
}

export function dismiss(id) {
  const i = state.items.findIndex((t) => t.id === id);
  if (i >= 0) state.items.splice(i, 1);
}
