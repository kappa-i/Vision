<script setup>
import { ref } from "vue";
import { X } from "lucide-vue-next";

const emit = defineEmits(["close", "submit"]);

const name = ref("");
const description = ref("");

function handleSubmit() {
  if (!name.value.trim()) return;
  emit("submit", { name: name.value, description: description.value });
}
</script>

<template>
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="w-full max-w-lg shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-surface p-8 shadow-2xl shadow-ink/10"
    >
      <header class="mb-8 flex items-center justify-between">
        <h2 class="text-3xl font-bold tracking-tight text-ink">
          Nouveau Projet
        </h2>
        <button
          type="button"
          class="text-muted transition hover:text-ink"
          @click="emit('close')"
        >
          <X class="h-6 w-6" />
        </button>
      </header>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div>
          <label class="mb-2 block text-[10px] font-semibold tracking-wide text-ink">
            Titre du projet *
          </label>
          <input
            v-model="name"
            type="text"
            autofocus
            placeholder="Ex: Campagne Été..."
            class="w-full border-b-2 border-line bg-transparent px-0 py-3 text-2xl font-bold uppercase tracking-tight text-ink outline-none placeholder:text-muted focus:border-ink transition-colors"
          />
        </div>

        <div>
          <label class="mb-2 block text-[10px] font-semibold tracking-wide text-ink">
            Description (facultatif)
          </label>
          <textarea
            v-model="description"
            rows="3"
            placeholder="Bref contexte ou intentions du projet..."
            class="w-full resize-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-canvas p-4 text-sm text-ink outline-none focus:border-ink transition-colors"
          ></textarea>
        </div>

        <div class="mt-8 flex items-center justify-end gap-4">
          <button
            type="button"
            class="text-[10px] font-semibold tracking-wide text-muted transition hover:text-ink"
            @click="emit('close')"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="!name.trim()"
            class="bg-accent px-8 py-4 text-[10px] font-semibold tracking-wide text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Créer le projet
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
