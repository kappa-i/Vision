<script setup>
import { gsap } from "gsap";
import { toasts, dismiss } from "../store/toast";

const cls = {
  info: "bg-surface shadow-sm shadow-black/5 rounded-none-none border border-line/30 text-ink",
  success: "bg-emerald-900/40 border border-emerald-900/50 text-emerald-400",
  error: "bg-rose-900/40 border border-rose-900/50 text-rose-400",
};

function onEnter(el, done) {
  gsap.fromTo(
    el,
    { x: 48, autoAlpha: 0 },
    { x: 0, autoAlpha: 1, duration: 0.3, ease: "power3.out", onComplete: done }
  );
}

function onLeave(el, done) {
  gsap.to(el, {
    x: 48,
    autoAlpha: 0,
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    duration: 0.22,
    ease: "power2.in",
    onComplete: done,
  });
}
</script>

<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      :css="false"
      class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2"
      @enter="onEnter"
      @leave="onLeave"
    >
      <button
        v-for="t in toasts.items"
        :key="t.id"
        type="button"
        class="max-w-xs overflow-hidden px-4 py-2.5 text-left text-sm font-medium shadow-lg"
        :class="cls[t.type] || cls.info"
        @click="dismiss(t.id)"
      >
        {{ t.message }}
      </button>
    </TransitionGroup>
  </Teleport>
</template>
