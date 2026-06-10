<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";
import { acquireScreenGuard, releaseScreenGuard } from "../services/screenGuard";

const loaded = ref(false);
const overlayRef = ref(null);
const imageWrapRef = ref(null);

const props = defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: "" },
  // Vue protégée : active la protection capture d'écran tant qu'elle est ouverte
  protect: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);

function onKey(e) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  if (props.protect) acquireScreenGuard();
  // Entrée : backdrop fade + image scale
  gsap.fromTo(overlayRef.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "power2.out" });
  gsap.fromTo(
    imageWrapRef.value,
    { scale: 0.94, autoAlpha: 0 },
    { scale: 1, autoAlpha: 1, duration: 0.3, delay: 0.04, ease: "power3.out" }
  );
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  if (props.protect) releaseScreenGuard();
});
</script>

<template>
  <Teleport to="body">
    <div
      ref="overlayRef"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      @click="emit('close')"
    >
      <div ref="imageWrapRef" class="relative flex items-center justify-center" @click.stop>
        <div v-if="!loaded" class="absolute flex flex-col items-center justify-center">
          <span class="animate-pulse bg-surface px-6 py-3 text-xl font-bold tracking-tight text-ink shadow-xl shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30">
            Chargement
          </span>
        </div>
        <img
          :src="src"
          :alt="alt"
          draggable="false"
          decoding="async"
          class="max-h-[90vh] max-w-full select-none rounded-none-none object-contain shadow-2xl transition-opacity duration-300"
          :class="loaded ? 'opacity-100' : 'opacity-0'"
          @load="loaded = true"
          @contextmenu.prevent
        />
      </div>
      <button
        type="button"
        class="absolute right-5 top-4 text-2xl leading-none text-white/80 hover:text-white"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>
  </Teleport>
</template>
