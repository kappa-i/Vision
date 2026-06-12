<script setup>
import { onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";
import { confirmState, resolveConfirm } from "../services/dialogs";

function onKeydown(e) {
  if (!confirmState.open) return;
  if (e.key === "Escape") resolveConfirm(false);
  if (e.key === "Enter") resolveConfirm(true);
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function onEnter(el, done) {
  const panel = el.querySelector("[data-panel]");
  gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: "power2.out" });
  gsap.fromTo(
    panel,
    { autoAlpha: 0, y: 16, scale: 0.97 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: "power3.out", onComplete: done }
  );
}

function onLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, duration: 0.15, ease: "power2.in", onComplete: done });
}
</script>

<template>
  <Transition :css="false" @enter="onEnter" @leave="onLeave">
    <div
      v-if="confirmState.open"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
      @click.self="resolveConfirm(false)"
    >
      <div data-panel class="w-full max-w-md border-2 border-ink bg-surface p-6 shadow-2xl shadow-ink/10">
        <p class="text-[10px] font-bold uppercase tracking-widest text-muted">
          {{ confirmState.title }}
        </p>
        <p class="mt-3 text-base font-bold leading-snug tracking-tight text-ink">
          {{ confirmState.message }}
        </p>
        <div class="mt-6 flex items-center justify-end gap-5">
          <button
            type="button"
            class="text-sm text-muted transition hover:text-ink"
            @click="resolveConfirm(false)"
          >
            {{ confirmState.cancelLabel }}
          </button>
          <button
            type="button"
            class="bg-accent px-6 py-2.5 text-sm font-bold text-canvas transition hover:opacity-90"
            @click="resolveConfirm(true)"
          >
            {{ confirmState.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
