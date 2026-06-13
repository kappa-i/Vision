<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { gsap } from "gsap";
import { useRoute } from "vue-router";
import { mediaFor, loadMedia } from "../../store/media";
import { currentDecision, loadValidations } from "../../store/validations";
import {
  findProject,
  loadProjects,
  updateProjectStatus,
  projects,
  STATUS,
} from "../../store/projects";
import { assetUrl, thumbUrl, basename, downloadFile, downloadAll } from "../../services/files";
import { setInDelivery } from "../../store/media";
import { can } from "../../store/session";
import { toast } from "../../store/toast";
import { Lock, CheckCircle, Download, Check } from "lucide-vue-next";

const route = useRoute();
const projectId = computed(() => route.params.id);
const busyId = ref(null);
const justSaved = ref(null);
const busyAll = ref(false);
const confirmingRelease = ref(false);
const heroRef = ref(null);
const displayCount = ref(0);

function seenKey() {
  return `vision_delivery_seen_${projectId.value}`;
}

let countingUp = false;

async function maybeAnimateHero() {
  if (!released.value || can.uploadMedia.value || !deliverables.value.length) return;
  await nextTick();
  if (!heroRef.value) return;

  const firstTime = !localStorage.getItem(seenKey());
  localStorage.setItem(seenKey(), "1");

  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  if (firstTime) {
    countingUp = true;
    const counter = { n: 0 };
    displayCount.value = 0;
    tl.fromTo(heroRef.value,
      { autoAlpha: 0, y: 32, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.55 }
    ).to(counter, {
      n: deliverables.value.length,
      duration: 1,
      ease: "power2.out",
      snap: { n: 1 },
      onUpdate: () => { displayCount.value = Math.round(counter.n); },
      onComplete: () => {
        countingUp = false;
        displayCount.value = deliverables.value.length;
      },
    }, "<0.15");
  } else {
    tl.fromTo(heroRef.value,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.3 }
    );
  }
}

onMounted(() => {
  if (!projects.loaded) loadProjects();
  loadMedia(projectId.value, "gallery");
  loadValidations(projectId.value);
});

// Photos approuvées par le client — le créatif choisit lesquelles livrer
const approvedPhotos = computed(() =>
  mediaFor(projectId.value, "gallery").filter((m) => m.approval === "approved")
);

// Livrables = photos que le créatif a marquées in_delivery
const deliverables = computed(() =>
  approvedPhotos.value.filter((m) => m.in_delivery)
);

const project = computed(() => findProject(projectId.value));

// Le client a validé la sélection (son rôle)
const approved = computed(
  () =>
    currentDecision(projectId.value) === "approved" ||
    project.value?.status === STATUS.VALIDATED ||
    project.value?.status === STATUS.DELIVERED
);

// Le créatif a remis les fichiers (acte distinct de la validation)
const released = computed(() => project.value?.status === STATUS.DELIVERED);

// Le compteur suit toujours la réalité (les updates realtime arrivent
// photo par photo) ; il n'est figé que pendant l'animation de décompte.
watch(
  () => deliverables.value.length,
  (n) => { if (!countingUp) displayCount.value = n; },
  { immediate: true }
);

// Téléchargement : le créatif accède toujours à ses fichiers ; le client
// seulement après remise officielle.
const canDownload = computed(() => can.uploadMedia.value || released.value);

// Déclenche une seule fois quand les données sont prêtes.
// NB : avec immediate:true le callback peut s'exécuter avant que watch()
// ait renvoyé la fonction stop — d'où le flag + l'arrêt différé.
let heroFired = false;
let stopHeroWatch = null;
stopHeroWatch = watch(
  () => released.value && deliverables.value.length > 0 && !can.uploadMedia.value,
  (ready) => {
    if (ready && !heroFired) {
      heroFired = true;
      stopHeroWatch?.();
      maybeAnimateHero();
    }
  },
  { immediate: true }
);
if (heroFired) stopHeroWatch();

onUnmounted(() => stopHeroWatch?.());

async function downloadEverything() {
  busyAll.value = true;
  try {
    const res = await downloadAll(deliverables.value.map((m) => m.path));
    if (res) toast(`${res.count} fichier(s) enregistré(s).`, "success");
  } finally {
    busyAll.value = false;
  }
}

async function download(m) {
  busyId.value = m.id;
  try {
    const dest = await downloadFile(m.path);
    if (dest) justSaved.value = m.id;
  } catch (e) {
    console.error("Échec téléchargement:", e);
    toast("Téléchargement échoué. Réessayez.", "error");
  } finally {
    busyId.value = null;
  }
}

function release() {
  updateProjectStatus(projectId.value, STATUS.DELIVERED);
  confirmingRelease.value = false;
}
</script>

<template>
  <section class="mx-auto max-w-4xl">

    <!-- Header avec compteur -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-ink">Livraison</h2>
        <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
          Les fichiers approuvés, remis au client après accord.
        </p>
      </div>
      <div v-if="approved && deliverables.length" class="text-right">
        <p class="text-4xl font-black tracking-tighter text-ink">{{ deliverables.length }}</p>
        <p class="text-[10px] font-bold uppercase tracking-widest text-muted">
          {{ deliverables.length > 1 ? "fichiers approuvés" : "fichier approuvé" }}
        </p>
      </div>
    </div>

    <!-- 1. En attente de la validation du client -->
    <div
      v-if="!approved"
      class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 bg-surface/50 py-24 text-center"
    >
      <Lock class="mb-4 h-8 w-8 text-muted" />
      <p class="text-xl font-bold tracking-tight text-muted px-8">
        La livraison s'ouvrira une fois la sélection validée par le client.
      </p>
      <p class="mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Onglet Validation
      </p>
    </div>

    <template v-else>

      <!-- ── VUE CRÉATIF ── -->
      <template v-if="can.uploadMedia.value">

        <!-- Livré -->
        <div
          v-if="released"
          class="mb-8 flex items-center gap-3 border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm font-medium text-indigo-500"
        >
          <CheckCircle class="h-5 w-5 shrink-0" />
          Projet livré — les fichiers sont à disposition du client.
        </div>

        <!-- Prêt à remettre : état normal -->
        <div v-else-if="!confirmingRelease" class="mb-8 flex items-center justify-between border border-line/30 bg-surface p-6 shadow-sm">
          <div>
            <p class="font-bold text-ink">
              {{ deliverables.length }} fichier(s) prêt(s) à remettre
            </p>
            <p class="mt-1 text-sm text-muted">
              Le client n'a pas encore accès aux fichiers.
            </p>
          </div>
          <button
            type="button"
            :disabled="deliverables.length === 0"
            class="flex items-center gap-2 bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:opacity-90 disabled:opacity-40"
            @click="confirmingRelease = true"
          >
            Remettre au client
          </button>
        </div>

        <!-- Confirmation de remise -->
        <div v-else class="mb-8 border-2 border-ink bg-surface p-6">
          <p class="font-bold tracking-tight text-ink">Confirmer la remise</p>
          <p class="mt-2 text-sm text-muted leading-relaxed">
            Vous allez remettre <strong class="text-ink">{{ deliverables.length }} fichier(s) approuvé(s)</strong> au client.
            Il pourra les télécharger immédiatement. <br>Cette action est définitive.
          </p>
          <div class="mt-5 flex items-center gap-4">
            <button
              type="button"
              class="bg-accent px-6 py-2.5 text-sm font-bold text-canvas transition hover:opacity-90"
              @click="release"
            >
              Confirmer la remise
            </button>
            <button
              type="button"
              class="text-sm text-muted transition hover:text-ink"
              @click="confirmingRelease = false"
            >
              Annuler
            </button>
          </div>
        </div>

        <!-- Sélection de livraison créatif -->
        <template v-if="approvedPhotos.length">
          <div class="mb-4 flex items-center justify-between">
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted">
              {{ approvedPhotos.length }} photo(s) approuvée(s) — {{ deliverables.length }} sélectionnée(s) pour la livraison
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                class="text-[10px] font-bold uppercase tracking-widest text-muted transition hover:text-ink"
                @click="approvedPhotos.forEach(m => setInDelivery(m, true))"
              >
                Tout sélectionner
              </button>
              <span class="text-muted">·</span>
              <button
                type="button"
                class="text-[10px] font-bold uppercase tracking-widest text-muted transition hover:text-ink"
                @click="approvedPhotos.forEach(m => setInDelivery(m, false))"
              >
                Tout désélectionner
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="m in approvedPhotos"
              :key="m.id"
              type="button"
              class="group relative aspect-square overflow-hidden border-2 bg-surface transition-all"
              :class="m.in_delivery ? 'border-ink' : 'border-transparent opacity-50 hover:opacity-80'"
              @click="setInDelivery(m, !m.in_delivery)"
            >
              <img
                :src="thumbUrl(m)"
                :alt="m.title || ''"
                :draggable="false"
                loading="lazy"
                decoding="async"
                class="h-full w-full select-none object-cover"
                @contextmenu.prevent
              />
              <!-- Checkmark si sélectionné -->
              <span
                v-if="m.in_delivery"
                class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center bg-ink"
              >
                <Check class="h-3 w-3 text-canvas" />
              </span>
              <!-- Titre au survol -->
              <div class="absolute inset-x-0 bottom-0 translate-y-full bg-black/75 px-2 py-1.5 transition-transform duration-200 group-hover:translate-y-0">
                <p class="truncate text-[10px] font-semibold text-white">{{ m.title || basename(m.path) }}</p>
              </div>
            </button>
          </div>
        </template>

        <div
          v-else
          class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 bg-surface/50 py-16 text-center"
        >
          <p class="text-base font-bold tracking-tight text-muted px-8">
            Aucune photo approuvée pour l'instant.
          </p>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Le client approuve les photos dans la Galerie
          </p>
        </div>
      </template>

      <!-- ── VUE CLIENT ── -->
      <template v-else>

        <!-- En attente de remise — PAS de liste de fichiers verrouillés -->
        <div
          v-if="!released"
          class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 bg-surface/50 py-24 text-center"
        >
          <p class="text-5xl font-black tracking-tighter text-ink">{{ deliverables.length }}</p>
          <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            {{ deliverables.length > 1 ? "photos approuvées" : "photo approuvée" }}
          </p>
          <p class="mt-6 text-base font-bold tracking-tight text-muted">
            En attente de la remise par le créatif.
          </p>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Vous serez notifié dès que les fichiers sont disponibles.
          </p>
        </div>

        <!-- Fichiers disponibles -->
        <template v-else>
          <!-- CTA hero -->
          <div
            v-if="deliverables.length > 1"
            ref="heroRef"
            class="mb-8 border-2 border-ink bg-surface p-8 text-center shadow-sm"
          >
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted">
              Vos fichiers sont prêts
            </p>
            <p class="mt-2 text-5xl font-black tracking-tighter text-ink">
              {{ displayCount }}
            </p>
            <p class="text-[10px] font-bold uppercase tracking-widest text-muted">
              {{ deliverables.length > 1 ? "fichiers disponibles" : "fichier disponible" }}
            </p>
            <button
              type="button"
              :disabled="busyAll"
              class="mt-6 flex w-full items-center justify-center gap-2 bg-accent py-3.5 text-sm font-bold uppercase tracking-wide text-canvas transition hover:opacity-90 disabled:opacity-50"
              @click="downloadEverything"
            >
              <Download class="h-4 w-4" />
              {{ busyAll ? "Téléchargement…" : "Tout télécharger" }}
            </button>
          </div>

          <!-- Galerie téléchargeable -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div
              v-for="m in deliverables"
              :key="m.id"
              class="group flex flex-col"
            >
              <!-- Image + overlay dans leur propre conteneur -->
              <div class="relative aspect-square overflow-hidden border border-line/30 bg-surface">
                <img
                  :src="thumbUrl(m)"
                  :alt="m.title || ''"
                  :draggable="false"
                  loading="lazy"
                  decoding="async"
                  class="h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-105"
                  @contextmenu.prevent
                />
                <!-- Overlay téléchargement -->
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button
                    type="button"
                    :disabled="busyId === m.id"
                    class="flex items-center gap-2 border-2 border-white bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white backdrop-blur-sm transition hover:bg-white hover:text-black disabled:opacity-60"
                    @click="download(m)"
                  >
                    <Download class="h-3.5 w-3.5" />
                    {{ busyId === m.id ? "…" : "Télécharger" }}
                  </button>
                  <span v-if="justSaved === m.id" class="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                    <Check class="h-3 w-3" /> Enregistré
                  </span>
                </div>
              </div>
              <!-- Titre en dehors de l'overflow-hidden -->
              <div class="border border-t-0 border-line/30 px-2 py-1.5">
                <p class="truncate text-[10px] font-semibold text-muted">{{ m.title || basename(m.path) }}</p>
              </div>
            </div>
          </div>
        </template>
      </template>

    </template>
  </section>
</template>
