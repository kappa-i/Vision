import { reactive, computed, readonly } from "vue";

/**
 * Onboarding — visite guidée au 1er lancement.
 *
 * Deux tours indépendants :
 *  - "dashboard" : première arrivée sur le Dashboard
 *  - "project"   : première ouverture d'un projet
 *
 * La complétion est persistée dans localStorage.
 */

const STORAGE_KEY = "vision.onboarding";

function loadCompleted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistCompleted(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Définitions des tours ---

const TOURS = {
  dashboard: [
    {
      target: null, // modal centré, pas de cible DOM
      title: "Bienvenue sur Vision !",
      description:
        "Votre espace de collaboration créatif ↔ client. Suivez cette courte visite pour découvrir les fonctionnalités clés.",
      placement: "center",
    },
    {
      target: "#sidebar-nav",
      title: "Navigation",
      description:
        "Accédez à vos projets et paramètres depuis cette barre latérale.",
      placement: "right",
    },
    {
      target: "#btn-new-project",
      title: "Créer un projet",
      description:
        "Cliquez ici pour démarrer un nouvel espace de collaboration avec votre client.",
      placement: "bottom",
    },
    {
      target: "#btn-join-code",
      title: "Rejoindre un projet",
      description:
        "Vous avez reçu un code d'invitation ? Rejoignez le projet de votre créatif ici.",
      placement: "bottom",
    },
  ],

  project: [
    {
      target: "#tab-about",
      title: "Tableau de bord",
      description:
        "Vue d'ensemble du projet : phase actuelle, prochaine action, chiffres clés.",
      placement: "bottom",
    },
    {
      target: "#tab-moodboard",
      title: "Moodboard",
      description:
        "Posez votre direction artistique : images de référence, ambiance, inspirations.",
      placement: "bottom",
    },
    {
      target: "#tab-gallery",
      title: "Galerie",
      description:
        "Uploadez vos photos, organisez-les en albums. Comparez avant/après et annotez.",
      placement: "bottom",
    },
    {
      target: "#tab-validation",
      title: "Validation",
      description:
        "Votre client approuve ou demande des révisions : le statut est visible des deux côtés.",
      placement: "bottom",
    },
    {
      target: "#tab-feedback",
      title: "Feedback",
      description:
        "Tous les commentaires regroupés, fini les retours éparpillés par mail ou WhatsApp.",
      placement: "bottom",
    },
    {
      target: "#btn-invite",
      title: "Inviter le client",
      description:
        "Générez un code d'invitation pour que votre client accède au projet en un clic.",
      placement: "bottom-end",
    },
  ],
};

// --- État réactif global ---

const state = reactive({
  active: false,
  tourName: null,
  stepIndex: 0,
  completed: loadCompleted(),
});

// --- API publique ---

export function shouldShow(tourName) {
  return !state.completed[tourName];
}

export function startTour(tourName) {
  if (!TOURS[tourName]) return;
  state.tourName = tourName;
  state.stepIndex = 0;
  state.active = true;
}

export function nextStep() {
  const steps = TOURS[state.tourName];
  if (!steps) return;
  if (state.stepIndex < steps.length - 1) {
    state.stepIndex++;
  } else {
    completeTour();
  }
}

export function prevStep() {
  if (state.stepIndex > 0) state.stepIndex--;
}

export function skipTour() {
  completeTour();
}

function completeTour() {
  state.completed[state.tourName] = true;
  persistCompleted(state.completed);
  state.active = false;
  state.tourName = null;
  state.stepIndex = 0;
}

export function resetTours() {
  state.completed = {};
  persistCompleted({});
  state.active = false;
  state.tourName = null;
  state.stepIndex = 0;
}

// --- Computed exposés ---

export const onboarding = readonly(state);

export const currentSteps = computed(() =>
  state.tourName ? TOURS[state.tourName] || [] : []
);

export const currentStep = computed(() =>
  currentSteps.value[state.stepIndex] || null
);

export const totalSteps = computed(() => currentSteps.value.length);

export const progress = computed(() => ({
  current: state.stepIndex + 1,
  total: totalSteps.value,
}));
