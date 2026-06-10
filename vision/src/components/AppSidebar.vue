<script setup>
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { auth, signOut } from "../services/auth";
import { session } from "../store/session";
import { LayoutGrid, Settings, LogOut, Sun, Moon, User } from "lucide-vue-next";
import { theme, toggleTheme } from "../composables/useTheme";
import LogoSmallBlack from "../assets/logoSmall.png";
import LogoSmallWhite from "../assets/LogoSmallWhite.png";

const router = useRouter();

const nav = [
  { name: "dashboard", label: "Projets", icon: LayoutGrid },
  { name: "settings", label: "Paramètres", icon: Settings },
];

async function handleSignOut() {
  await signOut();
  router.push({ name: "auth" });
}

const userInitial = computed(() => {
  return auth.profile?.name ? auth.profile.name.charAt(0).toUpperCase() : '?';
});
</script>

<template>
  <aside
    class="fixed left-6 top-1/2 z-50 flex -translate-y-1/2 flex-col items-center gap-6 shadow-sm shadow-black/5 rounded-none border border-line/30 bg-surface py-6 px-3 shadow-2xl shadow-black/5"
  >
    <!-- Logo -->
    <div class="flex items-center justify-center">
      <img :src="theme === 'dark' ? LogoSmallWhite : LogoSmallBlack" alt="V." class="h-8 w-auto" />
    </div>

    <!-- Navigation -->
    <nav id="sidebar-nav" class="flex flex-col gap-4">
      <RouterLink
        v-for="item in nav"
        :key="item.name"
        :to="{ name: item.name }"
        :title="item.label"
        class="flex h-10 w-10 items-center justify-center border border-transparent text-muted transition hover:border-line hover:text-ink"
        active-class="!border-ink !text-ink"
      >
        <component :is="item.icon" class="h-5 w-5" />
      </RouterLink>
    </nav>

    <!-- Bottom Actions -->
    <div class="mt-4 flex flex-col gap-4 border-t border-line pt-4">
      <!-- Thème Toggle -->
      <button
        type="button"
        title="Basculer le thème"
        class="flex h-10 w-10 items-center justify-center border border-transparent text-muted transition hover:border-line hover:text-ink"
        @click="toggleTheme"
      >
        <Sun v-if="theme === 'dark'" class="h-5 w-5" />
        <Moon v-else class="h-5 w-5" />
      </button>

      <!-- User Badge -->
      <div
        :title="session.role === 'client' ? 'Mode client' : 'Mode créatif'"
        class="flex h-10 w-10 items-center justify-center shadow-sm shadow-black/5 rounded-none border border-line/30 text-canvas bg-accent"
      >
        <span class="text-[10px] font-semibold tracking-wide">{{ userInitial }}</span>
      </div>

      <!-- Sign Out -->
      <button
        type="button"
        title="Déconnexion"
        class="flex h-10 w-10 items-center justify-center border border-transparent text-muted transition hover:border-rose-500 hover:text-rose-500"
        @click="handleSignOut"
      >
        <LogOut class="h-5 w-5" />
      </button>
    </div>
  </aside>
</template>
