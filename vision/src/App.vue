<script setup>
import { watch, computed } from "vue";
import { useRoute } from "vue-router";
import { gsap } from "gsap";
import AppSidebar from "./components/AppSidebar.vue";
import { setScreenProtection } from "./services/screenGuard";
import { session, ROLES } from "./store/session";
import Toaster from "./components/Toaster.vue";

const route = useRoute();
const isAuthPage = computed(() => route.name === "auth");

watch(
  () => session.role,
  (r) => setScreenProtection(r === ROLES.CLIENT),
  { immediate: true }
);

// Clé stable par projet : évite de re-monter ProjectPage lors des changements d'onglet
function pageKey(r) {
  if (r.params.id) return `project-${r.params.id}`;
  return r.fullPath;
}

function onEnter(el, done) {
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", onComplete: done }
  );
}

function onLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, y: -8, duration: 0.18, ease: "power2.in", onComplete: done });
}
</script>

<template>
  <div class="relative h-full w-full bg-canvas text-ink">
    <AppSidebar v-if="!isAuthPage" />
    <main :class="isAuthPage ? 'h-full w-full overflow-hidden p-0' : 'h-full w-full overflow-y-auto overflow-x-hidden pt-8 pb-16 pl-24 pr-8'">
      <router-view v-slot="{ Component, route: r }">
        <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave">
          <component :is="Component" :key="pageKey(r)" />
        </Transition>
      </router-view>
    </main>
    <Toaster />
  </div>
</template>
