<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import {
  onboarding,
  currentStep,
  progress,
  nextStep,
  prevStep,
  skipTour,
} from "../composables/useOnboarding";

/**
 * OnboardingTour — overlay spotlight + tooltip flottant.
 *
 * Affiche une découpe lumineuse sur l'élément ciblé par l'étape courante
 * et un tooltip explicatif positionné intelligemment.
 */

const spotlightStyle = ref({});
const tooltipStyle = ref({});
const tooltipRef = ref(null);
const visible = ref(false);
const transitioning = ref(false);

// Marge autour du spotlight
const PAD = 10;

function getTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function positionSpotlight(rect) {
  if (!rect) {
    // Pas de cible → spotlight centré (modal)
    spotlightStyle.value = {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "0px",
      height: "0px",
      transform: "translate(-50%, -50%)",
      borderRadius: "50%",
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
      pointerEvents: "none",
      transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
      zIndex: 9998,
    };
    return;
  }

  spotlightStyle.value = {
    position: "fixed",
    top: `${rect.top - PAD}px`,
    left: `${rect.left - PAD}px`,
    width: `${rect.width + PAD * 2}px`,
    height: `${rect.height + PAD * 2}px`,
    borderRadius: "10px",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
    pointerEvents: "none",
    transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
    zIndex: 9998,
  };
}

function positionTooltip(rect, placement) {
  const maxW = 320;
  const gap = 16;

  if (!rect) {
    // Centré (modal de bienvenue)
    tooltipStyle.value = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: `${maxW}px`,
      zIndex: 9999,
    };
    return;
  }

  const style = {
    position: "fixed",
    maxWidth: `${maxW}px`,
    zIndex: 9999,
    transform: "none",
  };

  switch (placement) {
    case "bottom":
      style.top = `${rect.bottom + PAD + gap}px`;
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = "translateX(-50%)";
      break;
    case "bottom-end":
      style.top = `${rect.bottom + PAD + gap}px`;
      style.right = `${window.innerWidth - rect.right - PAD}px`;
      break;
    case "top":
      style.bottom = `${window.innerHeight - rect.top + PAD + gap}px`;
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = "translateX(-50%)";
      break;
    case "right":
      style.top = `${rect.top + rect.height / 2}px`;
      style.left = `${rect.right + PAD + gap}px`;
      style.transform = "translateY(-50%)";
      break;
    case "left":
      style.top = `${rect.top + rect.height / 2}px`;
      style.right = `${window.innerWidth - rect.left + PAD + gap}px`;
      style.transform = "translateY(-50%)";
      break;
    default:
      style.top = `${rect.bottom + PAD + gap}px`;
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = "translateX(-50%)";
  }

  tooltipStyle.value = style;
}

function updatePosition() {
  const step = currentStep.value;
  if (!step) return;
  const rect = getTargetRect(step.target);
  positionSpotlight(rect);
  positionTooltip(rect, step.placement || "bottom");
}

// Réagit aux changements d'étape
watch(
  () => [onboarding.active, onboarding.stepIndex],
  async () => {
    if (!onboarding.active) {
      visible.value = false;
      return;
    }

    transitioning.value = true;
    // Petite pause pour laisser le DOM se mettre à jour
    await nextTick();
    // Attend un frame supplémentaire pour les éléments dynamiques
    await new Promise((r) => requestAnimationFrame(r));
    updatePosition();

    // Animation d'apparition
    setTimeout(() => {
      visible.value = true;
      transitioning.value = false;
    }, 50);
  },
  { immediate: true }
);

// Recalcule la position au resize
function handleResize() {
  if (onboarding.active) updatePosition();
}

onMounted(() => window.addEventListener("resize", handleResize));
onUnmounted(() => window.removeEventListener("resize", handleResize));
</script>

<template>
  <Teleport to="body">
    <template v-if="onboarding.active">
      <!-- Overlay cliquable pour fermer -->
      <div
        class="onboarding-overlay"
        @click.self="skipTour"
      />

      <!-- Spotlight (trou dans l'overlay) -->
      <div :style="spotlightStyle" />

      <!-- Tooltip -->
      <div
        ref="tooltipRef"
        :style="tooltipStyle"
        class="onboarding-tooltip"
        :class="{ 'onboarding-tooltip--visible': visible && !transitioning }"
      >
        <!-- Contenu -->
        <div class="onboarding-tooltip__body">
          <h3 class="onboarding-tooltip__title">
            {{ currentStep?.title }}
          </h3>
          <p class="onboarding-tooltip__desc">
            {{ currentStep?.description }}
          </p>
        </div>

        <!-- Footer : progression + boutons -->
        <div class="onboarding-tooltip__footer">
          <div class="onboarding-tooltip__dots">
            <span
              v-for="i in progress.total"
              :key="i"
              class="onboarding-dot"
              :class="{ 'onboarding-dot--active': i === progress.current }"
            />
          </div>

          <div class="onboarding-tooltip__actions">
            <button
              v-if="progress.current > 1"
              type="button"
              class="onboarding-btn onboarding-btn--ghost"
              @click="prevStep"
            >
              ←
            </button>
            <button
              type="button"
              class="onboarding-btn onboarding-btn--ghost"
              @click="skipTour"
            >
              Passer
            </button>
            <button
              type="button"
              class="onboarding-btn onboarding-btn--primary"
              @click="nextStep"
            >
              {{ progress.current < progress.total ? 'Suivant →' : 'Terminer ✓' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>
