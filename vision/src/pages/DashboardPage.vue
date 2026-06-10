<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { gsap } from "gsap";
import {
  projects,
  loadProjects,
  addProject,
  removeProject,
  STATUS,
  STATUS_LABEL,
} from "../store/projects";
import { can, ROLES, session, joinProjectAsClient, openAsCreatif } from "../store/session";
import { auth } from "../services/auth";
import { redeemCode } from "../store/invites";
import { latestActivityAt } from "../services/db";
import { markSeen, isNewer } from "../store/seen";
import OnboardingTour from "../components/OnboardingTour.vue";
import CreateProjectModal from "../components/CreateProjectModal.vue";
import { shouldShow, startTour } from "../composables/useOnboarding";
import { assetUrl } from "../services/files";
import { FolderPlus, Trash2, Plus } from "lucide-vue-next";

const router = useRouter();
const creating = ref(false);
const container = ref(null);
let ctx;

const joining = ref(false);
const codeInput = ref("");
const joinError = ref("");

// Dernière activité par projet (pour les pastilles « non lu »)
const activity = reactive({});

async function refreshActivity() {
  for (const p of projects.items) {
    activity[p.id] = await latestActivityAt(p.id);
  }
}

function unread(p) {
  return isNewer(activity[p.id], p.id);
}

onMounted(async () => {
  openAsCreatif();
  await loadProjects();
  await refreshActivity();
  if (shouldShow("dashboard")) {
    setTimeout(() => startTour("dashboard"), 400);
  }
  // Stagger d'entrée des cartes projet
  ctx = gsap.context(() => {
    gsap.from(".project-card", {
      autoAlpha: 0,
      y: 28,
      duration: 0.5,
      stagger: 0.07,
      ease: "power3.out",
      clearProps: "all",
    });
  }, container.value);
});

onUnmounted(() => {
  ctx?.revert();
});

async function handleCreate({ name, description }) {
  if (!name.trim()) return;
  await addProject(name, description);
  creating.value = false;
}

async function handleJoin() {
  joinError.value = "";
  const invite = await redeemCode(codeInput.value);
  if (!invite) {
    joinError.value = "Code invalide ou introuvable.";
    return;
  }
  joinProjectAsClient(invite.project_id);
  codeInput.value = "";
  joining.value = false;
  router.push({ name: "about", params: { id: invite.project_id } });
}

const search = ref("");
const shownProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return projects.items;
  return projects.items.filter((p) => p.name.toLowerCase().includes(q));
});

const badgeClass = {
  [STATUS.DRAFT]: "bg-surface border border-line text-muted",
  [STATUS.REVISE]: "bg-rose-50 text-rose-600 border border-rose-200",
  [STATUS.VALIDATED]: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  [STATUS.DELIVERED]: "bg-indigo-50 text-indigo-600 border border-indigo-200",
};

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function open(p) {
  markSeen(p.id); // ouvrir le projet = on a vu les nouveautés
  router.push({ name: "about", params: { id: p.id } });
}

function onCardMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
  const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
  gsap.to(el, {
    rotateY: dx * 7,
    rotateX: -dy * 5,
    transformPerspective: 900,
    duration: 0.4,
    ease: "power2.out",
    overwrite: "auto",
  });
}

function onCardLeave(e) {
  gsap.to(e.currentTarget, {
    rotateX: 0,
    rotateY: 0,
    duration: 0.5,
    ease: "power3.out",
    overwrite: "auto",
  });
}

async function handleDelete(p) {
  if (
    window.confirm(
      `Supprimer « ${p.name} » et tout son contenu ? Cette action est définitive.`
    )
  ) {
    await removeProject(p.id);
  }
}
</script>

<template>
  <div ref="container" class="mx-auto max-w-7xl px-8 py-16">
    <header class="mb-12 flex items-end justify-between border-b border-line pb-8">
      <div>
        <h1 class="text-5xl font-bold tracking-tight">Projets</h1>
        <p class="mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Vos espaces de collaboration en cours.
        </p>
      </div>
      <div class="flex gap-2" v-if="projects.items.length > 0">
        <button
          v-if="can.createProject.value"
          id="btn-new-project"
          type="button"
          class="flex items-center gap-1.5 rounded-none-none bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90"
          @click="creating = !creating"
        >
          <Plus class="h-4 w-4" />
          Nouveau projet
        </button>
        <button
          id="btn-join-code"
          type="button"
          class="rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 px-4 py-2 text-sm font-medium transition hover:bg-canvas"
          @click="joining = !joining"
        >
          Rejoindre via un code
        </button>
      </div>
    </header>

    <CreateProjectModal
      v-if="creating && can.createProject.value"
      @close="creating = false"
      @submit="handleCreate"
    />

    <form
      v-if="joining"
      class="mb-6"
      @submit.prevent="handleJoin"
    >
      <div class="flex gap-2">
        <input
          v-model="codeInput"
          autofocus
          placeholder="Code d'invitation (ex. ABC123)…"
          class="flex-1 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-surface px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-accent"
        />
        <button
          type="submit"
          class="rounded-none-none bg-accent px-4 py-2 text-sm font-medium text-canvas"
        >
          Rejoindre
        </button>
      </div>
      <p v-if="joinError" class="mt-1.5 text-xs text-rose-600">{{ joinError }}</p>
    </form>

    <input
      v-if="projects.items.length > 3"
      v-model="search"
      placeholder="RECHERCHER UN PROJET…"
      class="mb-8 w-full border-b border-line bg-transparent py-4 text-2xl font-bold uppercase tracking-tight outline-none placeholder:text-line focus:border-ink"
    />

    <ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <li
        v-for="(p, index) in shownProjects"
        :key="p.id"
        class="project-card group relative flex h-72 cursor-pointer flex-col justify-between shadow-sm border border-line/30 bg-surface transition-colors hover:border-ink overflow-hidden"
        @click="open(p)"
        @mousemove="onCardMove"
        @mouseleave="onCardLeave"
      >
        <!-- Background -->
        <div v-if="p.cover_path" class="absolute inset-0 z-0">
          <img :src="assetUrl(p.cover_path)" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10"></div>
        </div>
        <div v-else class="absolute inset-0 z-0 bg-surface group-hover:bg-ink/5 transition"></div>

        <!-- Top: Status & Delete -->
        <div class="relative z-10 flex items-start justify-between p-6">
          <div class="flex gap-2">
            <span
              class="border px-2 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-sm"
              :class="[p.cover_path ? 'border-white/20 bg-black/40 text-white' : badgeClass[p.status]]"
            >
              {{ STATUS_LABEL[p.status] }}
            </span>
            <span
              class="border px-2 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-sm uppercase"
              :class="p.cover_path ? 'border-white/20 bg-black/40 text-white' : (p.owner_id === auth.user?.id ? 'border-line/30 bg-ink text-canvas' : 'border-amber-300 bg-amber-500 text-white')"
            >
              {{ p.owner_id === auth.user?.id ? 'Créatif' : 'Client' }}
            </span>
          </div>
          <button
            v-if="can.createProject.value"
            type="button"
            title="Supprimer le projet"
            class="hidden transition group-hover:block"
            :class="p.cover_path ? 'text-white/70 hover:text-rose-400' : 'text-muted hover:text-rose-500'"
            @click.stop="handleDelete(p)"
          >
            <Trash2 class="h-5 w-5" />
          </button>
        </div>

        <!-- Center Index (only if no cover) -->
        <div
          v-if="!p.cover_path"
          class="relative z-10 flex flex-1 items-center justify-center font-bold text-ink/5 select-none"
          style="font-size: 8rem; line-height: 1"
        >
          {{ String(projects.items.length - index).padStart(2, "0") }}
        </div>
        <div v-else class="flex-1"></div>

        <!-- Bottom: Title -->
        <div class="relative z-10 p-6">
          <h3 class="text-3xl font-bold tracking-tight line-clamp-2" :class="p.cover_path ? 'text-white' : 'text-ink'">
            {{ p.name }}
          </h3>
          <div class="mt-4 h-px w-6" :class="p.cover_path ? 'bg-white/50' : 'bg-muted'"></div>
        </div>
      </li>
    </ul>

    <!-- Aucun résultat de recherche -->
    <p
      v-if="projects.items.length && shownProjects.length === 0"
      class="rounded-none-none border border-dashed border-line py-12 text-center text-sm text-muted"
    >
      Aucun projet ne correspond à « {{ search }} ».
    </p>

    <!-- Aucun projet : écran d'accueil guidé -->
    <div
      v-else-if="projects.loaded && projects.items.length === 0"
      class="space-y-4"
    >
      <!-- Créatif -->
      <div
        v-if="can.createProject.value"
        class="rounded-none-none border border-dashed border-line py-14 text-center"
      >
        <FolderPlus class="mx-auto mb-2 h-12 w-12 text-muted/50" />
        <p class="mt-2 text-sm font-medium">Aucun projet pour l'instant</p>
        <p class="mx-auto mt-1 max-w-sm text-sm text-muted">
          Créez votre premier espace de collaboration : moodboard, galerie,
          validation et livraison, au même endroit.
        </p>
        <button
          type="button"
          class="mt-4 flex mx-auto items-center gap-1.5 rounded-none-none bg-accent px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90"
          @click="creating = true"
        >
          <Plus class="h-4 w-4" />
          Créer un projet
        </button>
      </div>

      <!-- Bloc "rejoindre" toujours visible si pas de projets -->
      <div class="rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-surface p-6">
        <p class="text-sm font-medium">Vous avez un code d'invitation ?</p>
        <p class="mt-0.5 text-sm text-muted">
          Votre créatif vous a transmis un code : entrez-le ci-dessous pour accéder au projet.
        </p>
        <form class="mt-3 flex gap-2" @submit.prevent="handleJoin">
          <input
            v-model="codeInput"
            placeholder="Code d'invitation (ex. ABC123)…"
            class="flex-1 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-canvas px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-accent"
          />
          <button
            type="submit"
            class="rounded-none-none bg-accent px-4 py-2 text-sm font-medium text-canvas"
          >
            Rejoindre
          </button>
        </form>
        <p v-if="joinError" class="mt-1.5 text-xs text-rose-600">{{ joinError }}</p>
      </div>
    </div>
    <OnboardingTour />
  </div>
</template>
