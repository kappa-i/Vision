import { ref, watch } from "vue";

// Thème initial basé sur le localStorage ou la préférence système, ou par défaut "light"
const getInitialTheme = () => {
  const stored = localStorage.getItem("vision-theme");
  if (stored === "dark" || stored === "light") return stored;
  return "light"; // Par défaut, on force le light pour le Brutalisme
};

export const theme = ref(getInitialTheme());

// Applique le thème au document et le sauvegarde
export function applyTheme(newTheme) {
  theme.value = newTheme;
  if (newTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("vision-theme", newTheme);
}

export function toggleTheme() {
  applyTheme(theme.value === "light" ? "dark" : "light");
}

// Appliquer au démarrage
applyTheme(theme.value);
