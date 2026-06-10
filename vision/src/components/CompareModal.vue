<script setup>
import { onMounted, onUnmounted } from "vue";
import CompareSlider from "./CompareSlider.vue";
import { acquireScreenGuard, releaseScreenGuard } from "../services/screenGuard";

const props = defineProps({
  before: { type: String, required: true },
  after: { type: String, required: true },
  title: { type: String, default: "" },
  protect: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);

function onKey(e) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  if (props.protect) acquireScreenGuard();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
  if (props.protect) releaseScreenGuard();
});
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6"
      @click="emit('close')"
    >
      <div class="w-full max-w-4xl" @click.stop>
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-medium text-white">
            {{ title }}
            <span class="ml-2 text-white/60">— touche \ pour basculer</span>
          </p>
          <button
            type="button"
            class="text-2xl leading-none text-white/80 hover:text-white"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>
        <CompareSlider :before="before" :after="after" />
      </div>
    </div>
  </Teleport>
</template>
