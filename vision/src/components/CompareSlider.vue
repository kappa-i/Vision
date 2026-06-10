<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { gsap } from "gsap";

const props = defineProps({
  before: { type: String, required: true },
  after: { type: String, required: true },
});

const showingBefore = ref(false);
const beforeRef = ref(null);
const afterRef = ref(null);

function toggle(toBefore) {
  if (toBefore === showingBefore.value) return;
  showingBefore.value = toBefore;

  const entering = toBefore ? beforeRef.value : afterRef.value;
  const leaving = toBefore ? afterRef.value : beforeRef.value;

  gsap.to(leaving, { autoAlpha: 0, duration: 0.22, ease: "power2.in" });
  gsap.fromTo(entering, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28, ease: "power2.out" });
}

// Raccourci clavier \ comme Lightroom
function onKey(e) {
  if (e.key === "\\") toggle(!showingBefore.value);
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="relative select-none overflow-hidden">
    <!-- Image après (retouchée) — base -->
    <img
      ref="afterRef"
      :src="after"
      draggable="false"
      decoding="async"
      class="block max-h-[85vh] w-full select-none object-contain"
      @contextmenu.prevent
    />
    <!-- Image avant (originale) — superposée, invisible par défaut -->
    <img
      ref="beforeRef"
      :src="before"
      draggable="false"
      decoding="async"
      class="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
      style="opacity: 0; visibility: hidden"
      @contextmenu.prevent
    />

    <!-- Label actif -->
    <span
      class="pointer-events-none absolute left-3 top-3 bg-black/60 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white"
    >
      {{ showingBefore ? "Original" : "Retouché" }}
    </span>

    <!-- Toggle bouton style Lightroom -->
    <div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 overflow-hidden border border-white/20 bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        class="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-150"
        :class="showingBefore ? 'bg-white text-black' : 'text-white/50 hover:text-white'"
        @click="toggle(true)"
      >
        Avant
      </button>
      <button
        type="button"
        class="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-150"
        :class="!showingBefore ? 'bg-white text-black' : 'text-white/50 hover:text-white'"
        @click="toggle(false)"
      >
        Après
      </button>
    </div>
  </div>
</template>
