<script setup>
import { computed, onMounted, ref } from "vue";
import { gsap } from "gsap";
import { useRoute, useRouter } from "vue-router";
import {
  validationsFor,
  currentDecision,
  loadValidations,
  decide,
} from "../../store/validations";
import { mediaFor, loadMedia } from "../../store/media";
import { assetUrl, thumbUrl } from "../../services/files";
import { can } from "../../store/session";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id);
const busy = ref(false);
const progressRef = ref(null);

onMounted(() => {
  loadValidations(projectId.value);
  loadMedia(projectId.value, "gallery");

  if (document.querySelector(".val-card")) {
    gsap.from(".val-card", {
      autoAlpha: 0,
      y: 20,
      duration: 0.45,
      stagger: 0.07,
      ease: "power3.out",
      clearProps: "all",
      delay: 0.05,
    });
  }
});

const decision = computed(() => currentDecision(projectId.value));
const history = computed(() => validationsFor(projectId.value));
const photos = computed(() => mediaFor(projectId.value, "gallery"));

const tally = computed(() => {
  const t = { approved: 0, revise: 0, pending: 0 };
  for (const m of photos.value) {
    if (m.approval === "approved") t.approved++;
    else if (m.approval === "revise") t.revise++;
    else t.pending++;
  }
  return t;
});

const toRevise = computed(() => photos.value.filter((m) => m.approval === "revise"));

const derived = computed(() => {
  if (tally.value.revise > 0) return "revise";
  if (tally.value.approved > 0) return "approved";
  return null;
});

const pctApproved = computed(() => photos.value.length ? Math.round((tally.value.approved / photos.value.length) * 100) : 0);
const pctRevise = computed(() => photos.value.length ? Math.round((tally.value.revise / photos.value.length) * 100) : 0);

async function commit() {
  if (!derived.value || busy.value) return;
  busy.value = true;
  try {
    await decide(projectId.value, derived.value);
  } finally {
    busy.value = false;
  }
}

function goGallery() {
  router.push({ name: "gallery", params: { id: projectId.value } });
}

const decisionLabel = (d) =>
  d === "approved" ? "Validé" : d === "revise" ? "À revoir" : "En attente";

function formatDate(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <section class="mx-auto max-w-4xl">

    <!-- Header -->
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-ink">Validation</h2>
        <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
          Le client juge chaque photo dans la Galerie — la décision globale en découle.
        </p>
      </div>
      <!-- Décision actuelle -->
      <div
        v-if="decision"
        class="border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
        :class="{
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-600': decision === 'approved',
          'border-rose-500/20 bg-rose-500/10 text-rose-600': decision === 'revise',
        }"
      >
        {{ decisionLabel(decision) }}
      </div>
    </div>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">

      <!-- Colonne principale -->
      <div class="lg:col-span-8 space-y-8">

        <!-- Barre de progression + compteurs -->
        <div v-if="photos.length" class="val-card">
          <p class="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted">
            Avancement — {{ photos.length }} photo(s)
          </p>
          <!-- Barre segmentée -->
          <div class="mb-6 flex h-2 w-full overflow-hidden bg-line/30">
            <div
              class="h-full bg-emerald-500 transition-all duration-700"
              :style="{ width: pctApproved + '%' }"
            />
            <div
              class="h-full bg-rose-500 transition-all duration-700"
              :style="{ width: pctRevise + '%' }"
            />
          </div>
          <!-- Compteurs -->
          <div class="grid grid-cols-3 gap-4">
            <div class="border-2 border-ink bg-surface p-4 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
              <p class="text-4xl font-black tracking-tighter text-emerald-600">{{ tally.approved }}</p>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Approuvées</p>
            </div>
            <div class="border-2 border-ink bg-surface p-4 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
              <p class="text-4xl font-black tracking-tighter text-rose-600">{{ tally.revise }}</p>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">À revoir</p>
            </div>
            <div class="border-2 border-ink bg-surface p-4 text-center shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
              <p class="text-4xl font-black tracking-tighter text-muted">{{ tally.pending }}</p>
              <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Non jugées</p>
            </div>
          </div>
        </div>

        <div v-else class="val-card flex flex-col items-center justify-center border-2 border-dashed border-line/30 bg-surface/50 py-16 text-center">
          <p class="text-base font-bold tracking-tight text-muted">Aucune photo dans la galerie.</p>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Le créatif doit d'abord uploader des photos.
          </p>
        </div>

        <!-- Photos à revoir (créatif uniquement) -->
        <div v-if="!can.validate.value && toRevise.length" class="val-card">
          <p class="mb-4 text-[10px] font-bold uppercase tracking-widest text-rose-600">
            {{ toRevise.length }} photo(s) à revoir
          </p>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="m in toRevise"
              :key="m.id"
              type="button"
              class="group relative aspect-square overflow-hidden border-2 border-rose-500/40 bg-surface transition hover:border-rose-500"
              @click="goGallery"
            >
              <img
                :src="thumbUrl(m)"
                :alt="m.title || ''"
                :draggable="false"
                loading="lazy"
                decoding="async"
                class="h-full w-full select-none object-cover"
              />
              <div class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p class="w-full truncate px-2 py-1.5 text-[10px] font-semibold text-white">
                  {{ m.title || "Sans titre" }}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Sidebar action + historique -->
      <div class="lg:col-span-4 space-y-6">

        <!-- Card d'action -->
        <div class="val-card border-2 border-ink bg-surface p-6 shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
          <p class="text-[10px] font-bold uppercase tracking-widest text-muted">Décision globale</p>

          <!-- État dérivé en temps réel -->
          <div class="mt-3">
            <template v-if="derived === 'approved'">
              <p class="text-xl font-black tracking-tight text-emerald-600">
                {{ tally.approved }} photo(s) approuvée(s)
              </p>
              <p v-if="tally.pending" class="mt-1 text-xs text-amber-600 font-semibold">
                {{ tally.pending }} non jugée(s) — elles ne seront pas incluses.
              </p>
            </template>
            <template v-else-if="derived === 'revise'">
              <p class="text-xl font-black tracking-tight text-rose-600">
                {{ tally.revise }} photo(s) à revoir
              </p>
            </template>
            <template v-else>
              <p class="text-xl font-black tracking-tight text-muted">
                En attente
              </p>
            </template>
          </div>

          <!-- Actions selon rôle -->
          <div v-if="can.validate.value" class="mt-6 border-t border-line/30 pt-6 space-y-3">
            <template v-if="!photos.length">
              <p class="text-xs text-muted">Aucune photo à valider.</p>
            </template>
            <template v-else-if="derived === null">
              <p class="mb-4 text-sm font-bold text-ink leading-snug">
                Rendez-vous dans la Galerie pour juger les photos.
              </p>
              <button
                type="button"
                class="w-full border-2 border-ink bg-surface px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-canvas"
                @click="goGallery"
              >
                Ouvrir la Galerie
              </button>
            </template>
            <template v-else-if="derived === 'revise'">
              <button
                type="button"
                :disabled="busy"
                class="w-full border-2 border-rose-600 bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-rose-700 disabled:opacity-50"
                @click="commit"
              >
                {{ busy ? "…" : "Renvoyer le projet" }}
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                :disabled="busy"
                class="w-full border-2 border-ink bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-canvas transition hover:opacity-90 disabled:opacity-50"
                @click="commit"
              >
                {{ busy ? "…" : `Valider la sélection (${tally.approved})` }}
              </button>
            </template>
          </div>
          <p v-else class="mt-6 border-t border-line/30 pt-6 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Seul le client peut soumettre la décision finale.
          </p>
        </div>

        <!-- Historique -->
        <div v-if="history.length" class="val-card">
          <p class="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted">Historique</p>
          <div class="space-y-2">
            <div
              v-for="v in history"
              :key="v.id"
              class="flex items-center justify-between border border-line/30 bg-surface px-4 py-3"
            >
              <span
                class="text-xs font-bold uppercase tracking-widest"
                :class="v.decision === 'approved' ? 'text-emerald-600' : 'text-rose-600'"
              >
                {{ decisionLabel(v.decision) }}
              </span>
              <span class="text-[10px] font-semibold text-muted">{{ formatDate(v.created_at) }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>
