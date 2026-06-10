import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import { initAuth } from "./services/auth";

// Désactive le menu contextuel (clic droit) sur toute l'app
window.addEventListener("contextmenu", (e) => e.preventDefault());

// Initialise la session Supabase avant de monter l'app
initAuth().then(() => {
  createApp(App).use(router).mount("#app");
});
