<script setup>
import { session, setRole, ROLES } from "../store/session";
</script>

<template>
  <div class="rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 p-2">
    <p class="px-1 pb-2 text-[10px] uppercase tracking-widest font-semibold font-medium uppercase tracking-wide text-muted">
      Point de vue
    </p>
    <div class="flex gap-1">
      <button
        type="button"
        class="flex-1 rounded-none-none px-2 py-1.5 text-xs font-medium transition"
        :class="
          session.role === ROLES.CREATIF
            ? 'bg-accent text-black'
            : 'text-muted hover:bg-canvas'
        "
        @click="setRole(ROLES.CREATIF)"
      >
        Créatif
      </button>
      <button
        type="button"
        class="flex-1 rounded-none-none px-2 py-1.5 text-xs font-medium transition"
        :class="
          session.role === ROLES.CLIENT
            ? 'bg-accent text-black'
            : 'text-muted hover:bg-canvas'
        "
        @click="setRole(ROLES.CLIENT)"
      >
        Client
      </button>
    </div>
  </div>
</template>
