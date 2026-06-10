<script setup>
import { computed, onMounted, onBeforeUnmount, nextTick, ref, watch } from "vue";
import { gsap } from "gsap";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { ArrowLeft } from "lucide-vue-next";
import { projects, loadProjects, findProject } from "../store/projects";
import { can, openAsCreatif, joinProjectAsClient } from "../store/session";
import { auth } from "../services/auth";
import { mediaFor, loadMedia } from "../store/media";
import { validationsFor, loadValidations } from "../store/validations";
import { commentsFor, loadComments } from "../store/comments";
import { markSeen, isNewer } from "../store/seen";
import InvitePanel from "../components/InvitePanel.vue";
import { useProjectRealtime } from "../composables/useProjectRealtime";

const props = defineProps({ id: { type: [String, Number], required: true } });
const route = useRoute();
const showInvite = ref(false);
const navRef = ref(null);
const indicatorRef = ref(null);

async function moveIndicator(instant = false) {
  await nextTick();
  if (!navRef.value || !indicatorRef.value) return;
  const activeEl = navRef.value.querySelector(`[data-tab="${route.name}"]`);
  if (!activeEl) return;
  const navRect = navRef.value.getBoundingClientRect();
  const tabRect = activeEl.getBoundingClientRect();
  const x = tabRect.left - navRect.left;
  const width = tabRect.width;
  if (instant) {
    gsap.set(indicatorRef.value, { x, width });
  } else {
    gsap.to(indicatorRef.value, { x, width, duration: 0.28, ease: "power2.inOut" });
  }
}

// Realtime : reçoit les mises à jour de l'autre machine
useProjectRealtime(props.id);

const tabs = [
  { name: "about", label: "À propos" },
  { name: "moodboard", label: "Moodboard" },
  { name: "gallery", label: "Galerie" },
  { name: "validation", label: "Validation" },
  { name: "delivery", label: "Livraison" },
  { name: "feedback", label: "Feedback" },
];

onMounted(() => {
  if (!projects.loaded) loadProjects();
  loadMedia(props.id, "moodboard");
  loadMedia(props.id, "gallery");
  loadValidations(props.id);
  loadComments(props.id);
  markSeen(props.id);
  moveIndicator(true);
});

onBeforeUnmount(() => {
  markSeen(props.id);
});

const project = computed(() => findProject(props.id));

watch(project, (p) => {
  if (p) {
    if (auth.user && p.owner_id && p.owner_id !== auth.user.id) {
      joinProjectAsClient(p.id);
    } else {
      openAsCreatif();
    }
  }
}, { immediate: true });

// Date de dernière activité par section
function newest(section) {
  let rows = [];
  if (section === "moodboard") rows = mediaFor(props.id, "moodboard");
  else if (section === "gallery") rows = mediaFor(props.id, "gallery");
  else if (section === "validation") rows = validationsFor(props.id);
  else if (section === "feedback") rows = commentsFor(props.id);
  return rows.reduce((max, r) => (r.created_at > max ? r.created_at : max), "");
}

// Pastille « non lu » sur un onglet (sauf celui qu'on regarde)
function tabUnread(name) {
  if (!["moodboard", "gallery", "validation", "feedback"].includes(name))
    return false;
  if (route.name === name) return false;
  return isNewer(newest(name), props.id, name);
}

function onTabEnter(el, done) {
  gsap.fromTo(el, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: "power2.out", onComplete: done });
}

function onTabLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, duration: 0.12, ease: "power2.in", onComplete: done });
}

function onPanelEnter(el, done) {
  gsap.fromTo(el, { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration: 0.32, ease: "power2.out", onComplete: done });
}

function onPanelLeave(el, done) {
  gsap.to(el, { height: 0, autoAlpha: 0, duration: 0.22, ease: "power2.in", onComplete: done });
}

watch(
  () => route.name,
  (name) => {
    if (["moodboard", "gallery", "validation", "feedback"].includes(name)) {
      markSeen(props.id, name);
    }
    moveIndicator(false);
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex h-full flex-col">
    <header class="border-b-2 border-line bg-surface px-8 pt-8">
      <div class="flex items-end justify-between">
        <!-- Navigation à gauche -->
        <nav ref="navRef" class="relative flex gap-8">
          <RouterLink
            v-for="tab in tabs"
            :key="tab.name"
            :data-tab="tab.name"
            :to="{ name: tab.name, params: { id } }"
            class="group relative pb-4 text-[13px] font-bold uppercase tracking-wider text-muted transition hover:text-ink"
            active-class="!text-ink"
          >
            {{ tab.label }}
            <!-- Unread Dot -->
            <span
              v-if="tabUnread(tab.name)"
              class="absolute -right-3 top-0 h-2 w-2 bg-ink"
            />
          </RouterLink>
          <!-- Indicateur glissant unique -->
          <span
            ref="indicatorRef"
            class="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-ink"
            style="width: 0"
          />
        </nav>

        <!-- Titre et Actions à droite -->
        <div class="flex items-end gap-6 pb-4">
          <button
            v-if="can.invite.value && project"
            type="button"
            class="border-2 border-ink bg-accent px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-canvas transition-transform hover:-translate-y-0.5 hover:shadow-md"
            @click="showInvite = !showInvite"
          >
            Inviter le client
          </button>
          <h1 class="text-3xl font-black leading-none tracking-tighter uppercase text-ink">
            {{ project ? project.name : "Projet introuvable" }}
          </h1>
        </div>
      </div>

      <Transition :css="false" @enter="onPanelEnter" @leave="onPanelLeave">
        <div v-if="showInvite && can.invite.value" class="overflow-hidden border-t-2 border-line">
          <div class="pb-6 pt-4">
            <InvitePanel :project-id="id" />
          </div>
        </div>
      </Transition>
    </header>

    <div class="flex-1 overflow-y-auto px-8 py-8">
      <RouterView v-slot="{ Component: TabComponent }">
        <Transition :css="false" mode="out-in" @enter="onTabEnter" @leave="onTabLeave">
          <component :is="TabComponent" :key="route.name" />
        </Transition>
      </RouterView>
    </div>
  </div>
</template>
