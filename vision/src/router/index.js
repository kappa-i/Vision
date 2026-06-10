import { createRouter, createWebHistory } from "vue-router";
import { auth } from "../services/auth";

// Pages — périmètre MVP (cahier des charges §10)
const routes = [
  {
    path: "/auth",
    name: "auth",
    component: () => import("../pages/AuthPage.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    name: "dashboard",
    component: () => import("../pages/DashboardPage.vue"),
  },
  {
    path: "/project/:id",
    component: () => import("../pages/ProjectPage.vue"),
    props: true,
    children: [
      { path: "", redirect: { name: "about" } },
      {
        path: "about",
        name: "about",
        component: () => import("../pages/project/AboutTab.vue"),
      },
      {
        path: "moodboard",
        name: "moodboard",
        component: () => import("../pages/project/MoodboardTab.vue"),
      },
      {
        path: "gallery",
        name: "gallery",
        component: () => import("../pages/project/GalleryTab.vue"),
      },
      {
        path: "validation",
        name: "validation",
        component: () => import("../pages/project/ValidationTab.vue"),
      },
      {
        path: "feedback",
        name: "feedback",
        component: () => import("../pages/project/FeedbackTab.vue"),
      },
      {
        path: "delivery",
        name: "delivery",
        component: () => import("../pages/project/DeliveryTab.vue"),
      },
    ],
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("../pages/SettingsPage.vue"),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("../pages/NotFoundPage.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Guard auth : redirige vers /auth si non connecté
// (attend la résolution de la session avant de juger)
router.beforeEach(async (to) => {
  // Routes publiques (page auth)
  if (to.meta.public) return true;

  // Attend que la session soit résolue au 1er chargement
  if (auth.loading) {
    await new Promise((resolve) => {
      const stop = setInterval(() => {
        if (!auth.loading) { clearInterval(stop); resolve(); }
      }, 50);
    });
  }

  if (!auth.user) {
    return { name: "auth" };
  }
  return true;
});

export default router;
