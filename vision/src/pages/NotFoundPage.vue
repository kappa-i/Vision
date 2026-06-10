<script setup>
import { RouterLink } from "vue-router";
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 text-center">
    <p class="text-4xl font-semibold">404</p>
    <p class="text-sm text-muted">Cette page n'existe pas.</p>
    <RouterLink
      :to="{ name: 'dashboard' }"
      class="text-sm font-medium text-accent hover:underline"
    >
      Retour aux projets
    </RouterLink>
  </div>
</template>
