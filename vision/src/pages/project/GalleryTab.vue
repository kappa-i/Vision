<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  mediaFor,
  loadMedia,
  uploadMedia,
  addPaths,
  removeMedia,
  setBefore,
  setApproval,
  toggleFavorite,
  setTitle,
} from "../../store/media";
import { assetUrl } from "../../services/files";
import { confirmDialog } from "../../services/dialogs";
import { can } from "../../store/session";
import { projects, loadProjects, findProject, STATUS } from "../../store/projects";
import { useRouter } from "vue-router";
import { toast } from "../../store/toast";
import CompareModal from "../../components/CompareModal.vue";
import AnnotateModal from "../../components/AnnotateModal.vue";
import { CheckCircle, Pencil } from "lucide-vue-next";
import { useFileDrop } from "../../composables/useFileDrop";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id);
const KIND = "gallery";
const busy = ref(false);
const editingTitleId = ref(null);
const titleDraft = ref("");
const compare = ref(null);
const annotate = ref(null);
const filter = ref("all");
const sort = ref("recent");
const cols = ref(3);

onMounted(() => {
  loadMedia(projectId.value, KIND);
  if (!projects.loaded) loadProjects();
});

const items = computed(() => mediaFor(projectId.value, KIND));

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "fav", label: "♥ Favoris" },
  { key: "approved", label: "✓ Approuvées" },
  { key: "revise", label: "↺ À revoir" },
];

const filtered = computed(() =>
  items.value.filter((m) => {
    if (filter.value === "fav") return m.starred;
    if (filter.value === "approved") return m.approval === "approved";
    if (filter.value === "revise") return m.approval === "revise";
    return true;
  })
);

const sorted = computed(() => {
  const arr = [...filtered.value];
  if (sort.value === "name")
    arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (sort.value === "old")
    arr.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  else arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return arr;
});

const hasAlbums = computed(() => items.value.some((m) => m.album));

const grouped = computed(() => {
  const map = new Map();
  for (const m of sorted.value) {
    const k = m.album || "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  return [...map.entries()]
    .sort((a, b) =>
      a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])
    )
    .map(([album, list]) => ({ album: album || "Sans album", items: list }));
});

// Bandeau CTA : client a tout jugé mais n'a pas encore validé
const allJudged = computed(() =>
  can.validate.value &&
  items.value.length > 0 &&
  items.value.every((m) => m.approval !== null)
);
const projectStatus = computed(() => findProject(projectId.value)?.status);
const showValidateCta = computed(() =>
  allJudged.value &&
  projectStatus.value !== STATUS.VALIDATED &&
  projectStatus.value !== STATUS.DELIVERED
);

const protect = computed(() => {
  if (can.uploadMedia.value) return false;
  return findProject(projectId.value)?.status !== STATUS.DELIVERED;
});

async function add() {
  busy.value = true;
  try {
    await uploadMedia(projectId.value, KIND);
  } finally {
    busy.value = false;
  }
}

function attachBefore(m) {
  setBefore(m);
}

async function confirmRemove(m) {
  if (await confirmDialog(`Retirer « ${m.title} » ?`, { title: "Retirer la photo", confirmLabel: "Retirer" })) {
    removeMedia(projectId.value, KIND, m);
  }
}

function startEditTitle(m) {
  editingTitleId.value = m.id;
  titleDraft.value = m.title || "";
}

function commitTitle(m) {
  const t = titleDraft.value.trim();
  if (t && t !== m.title) setTitle(m, t);
  editingTitleId.value = null;
}

function approveAll() {
  let n = 0;
  for (const m of items.value) {
    if (m.approval !== "approved") {
      setApproval(m, "approved");
      n++;
    }
  }
  if (n) toast(`${n} photo(s) approuvée(s).`, "success");
}

const { isDragging } = useFileDrop((paths) => {
  if (can.uploadMedia.value) addPaths(projectId.value, KIND, paths);
});
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-ink">Galerie d'avancement</h2>
        <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
          Jugez chaque photo directement, ou ouvrez-la pour annoter.
        </p>
      </div>
      <div class="flex items-center gap-4">
        <div v-if="items.length" class="flex shadow-md shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 bg-surface">
          <button
            type="button"
            class="px-3 py-1 text-[10px] font-black transition"
            :class="cols === 2 ? 'bg-ink text-canvas shadow-lg shadow-ink/20' : 'text-muted hover:text-ink'"
            @click="cols = 2"
          >
            2×2
          </button>
          <div class="w-0.5 bg-line"></div>
          <button
            type="button"
            class="px-3 py-1 text-[10px] font-black transition"
            :class="cols === 3 ? 'bg-ink text-canvas shadow-lg shadow-ink/20' : 'text-muted hover:text-ink'"
            @click="cols = 3"
          >
            3×3
          </button>
        </div>
        <button
          v-if="can.uploadMedia.value"
          type="button"
          :disabled="busy"
          class="bg-accent px-4 py-2 text-[10px] font-semibold tracking-wide text-canvas transition hover:opacity-90 disabled:opacity-50"
          @click="add"
        >
          {{ busy ? "Chargement…" : "Uploader des photos" }}
        </button>
        <button
          v-else-if="items.length"
          type="button"
          class="shadow-xl shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 px-4 py-2 text-[10px] font-semibold tracking-wide text-ink transition hover:bg-ink hover:text-canvas"
          @click="approveAll"
        >
          ✓ Tout approuver
        </button>
      </div>
    </div>

    <!-- Filtres + tri -->
    <div v-if="items.length" class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="px-4 py-2 text-sm font-medium transition-colors"
          :class="
            filter === f.key
              ? 'bg-ink text-canvas'
              : 'text-muted hover:bg-ink/5 hover:text-ink'
          "
          @click="filter = f.key"
        >
          {{ f.label }}
        </button>
      </div>
      <select
        v-model="sort"
        class="shadow-xl shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 bg-surface px-4 py-2 text-[10px] font-semibold tracking-wide text-ink outline-none hover:border-ink focus:border-ink transition-colors"
      >
        <option value="recent">Plus récentes</option>
        <option value="old">Plus anciennes</option>
        <option value="name">Nom (A→Z)</option>
      </select>
    </div>

    <!-- Grille -->
    <template v-if="sorted.length">
      <div v-for="g in grouped" :key="g.album" class="mb-8">
        <h3
          v-if="hasAlbums"
          class="mb-4 text-xl font-bold tracking-tight text-ink"
        >
          {{ g.album }}
        </h3>
        <div class="grid gap-4" :class="cols === 2 ? 'grid-cols-2' : 'grid-cols-3'">
          <figure
            v-for="m in g.items"
            :key="m.id"
            class="group relative cv-auto overflow-hidden shadow-xl shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 bg-surface"
            :class="{
              '!border-emerald-500': m.approval === 'approved',
              '!border-rose-500': m.approval === 'revise',
            }"
          >
            <img
              v-if="m.thumb_path"
              :src="assetUrl(m.thumb_path)"
              :alt="m.title || ''"
              :draggable="false"
              loading="lazy"
              decoding="async"
              class="aspect-[4/3] w-full cursor-zoom-in select-none bg-canvas object-cover"
              @click="annotate = m"
            />
            <div
              v-else
              class="aspect-[4/3] w-full animate-pulse cursor-wait bg-canvas"
              title="Miniature en cours de génération…"
            />
            <figcaption class="flex items-center justify-between gap-4 px-4 py-3">
              <input
                v-if="can.uploadMedia.value && editingTitleId === m.id"
                :value="titleDraft"
                class="min-w-0 flex-1 truncate border-b-2 border-accent bg-transparent px-1 text-sm font-bold uppercase tracking-widest text-ink outline-none"
                @input="titleDraft = $event.target.value"
                @blur="commitTitle(m)"
                @keydown.enter.prevent="commitTitle(m)"
                @keydown.escape="editingTitleId = null"
                @click.stop
                :ref="el => el && el.focus()"
              />
              <div v-else class="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  class="truncate text-sm font-bold uppercase tracking-widest text-ink"
                  :class="can.uploadMedia.value ? 'cursor-pointer hover:text-accent transition-colors' : ''"
                  :title="can.uploadMedia.value ? 'Renommer' : ''"
                  @click.stop="can.uploadMedia.value && startEditTitle(m)"
                >{{ m.title }}</span>
                <Pencil
                  v-if="can.uploadMedia.value"
                  class="h-3.5 w-3.5 shrink-0 cursor-pointer text-muted transition-colors hover:text-ink"
                  @click.stop="startEditTitle(m)"
                  title="Renommer"
                />
              </div>

              <!-- Actions client : juger + favori -->
              <div v-if="can.validate.value" class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  title="Approuver"
                  class="flex h-8 w-8 items-center justify-center text-sm font-black transition-colors"
                  :class="
                    m.approval === 'approved'
                      ? 'bg-emerald-500 text-white'
                      : 'shadow-md shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 text-muted hover:border-emerald-500 hover:text-emerald-500'
                  "
                  @click.stop="setApproval(m, 'approved')"
                >
                  ✓
                </button>
                <button
                  type="button"
                  title="À revoir"
                  class="flex h-8 w-8 items-center justify-center text-sm font-black transition-colors"
                  :class="
                    m.approval === 'revise'
                      ? 'bg-rose-500 text-white'
                      : 'shadow-md shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30 text-muted hover:border-rose-500 hover:text-rose-500'
                  "
                  @click.stop="setApproval(m, 'revise')"
                >
                  ↺
                </button>
                <button
                  type="button"
                  title="Favori"
                  class="flex h-8 w-8 items-center justify-center text-sm font-black transition-colors border-2"
                  :class="m.starred ? 'border-rose-500 text-rose-500' : 'border-line text-muted hover:border-rose-500 hover:text-rose-500'"
                  @click.stop="toggleFavorite(m)"
                >
                  {{ m.starred ? "♥" : "♡" }}
                </button>
              </div>

              <button
                v-else-if="m.before_path"
                type="button"
                class="shrink-0 text-[10px] font-semibold tracking-wide text-accent hover:underline"
                @click.stop="compare = m"
              >
                ⇆ Comparer
              </button>
            </figcaption>

            <!-- Comparer (client) : en haut à gauche -->
            <button
              v-if="can.validate.value && m.before_path"
              type="button"
              title="Comparer avant / après"
              class="absolute left-2 top-2 bg-ink px-3 py-1 text-[10px] font-semibold tracking-wide text-canvas"
              @click.stop="compare = m"
            >
              ⇆ Comparer
            </button>

            <!-- Outils créatif -->
            <button
              v-if="can.uploadMedia.value"
              type="button"
              :title="
                m.before_path
                  ? 'Remplacer la photo originale'
                  : 'Ajouter la photo originale (avant retouche) pour comparer'
              "
              class="absolute left-2 top-2 hidden bg-ink px-3 py-1 text-[10px] font-semibold tracking-wide text-canvas group-hover:block"
              @click.stop="attachBefore(m)"
            >
              {{ m.before_path ? "↺ Original" : "+ Original" }}
            </button>
            <button
              v-if="can.uploadMedia.value"
              type="button"
              title="Retirer"
              class="absolute right-2 top-2 hidden h-8 w-8 bg-rose-500 text-sm font-black text-white group-hover:flex items-center justify-center transition-transform hover:scale-110"
              @click.stop="confirmRemove(m)"
            >
              ✕
            </button>
          </figure>
        </div>
      </div>
    </template>

    <!-- Vides -->
    <div
      v-else-if="items.length"
      class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 rounded-none-none bg-surface/50 backdrop-blur-sm py-24 text-center"
    >
      <span class="text-xl font-bold tracking-tight text-muted">
        Aucune photo ne correspond à ce filtre.
      </span>
    </div>
    <div
      v-else
      class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 rounded-none-none bg-surface/50 backdrop-blur-sm py-24 text-center transition hover:border-ink hover:bg-ink/5"
      :class="can.uploadMedia.value ? 'cursor-pointer' : ''"
      @click="can.uploadMedia.value && add()"
    >
      <span class="px-8 text-xl font-bold tracking-tight text-muted">
        {{
          can.uploadMedia.value
            ? "Aucune photo. Cliquez pour uploader ou glissez-déposez."
            : "Le créatif n'a pas encore partagé de photos."
        }}
      </span>
    </div>

    <!-- CTA : toutes les photos jugées, validation pas encore faite -->
    <div
      v-if="showValidateCta"
      class="mt-8 flex items-center justify-between border-4 border-emerald-900/50 bg-emerald-950/40 p-6"
    >
      <p class="flex items-center text-lg font-bold tracking-tight text-emerald-400">
        <CheckCircle class="mr-3 h-6 w-6 shrink-0 text-emerald-400" /> Toutes les photos sont jugées
      </p>
      <button
        type="button"
        class="bg-emerald-600 px-6 py-3 text-[10px] font-semibold tracking-wide text-white transition hover:opacity-90"
        @click="router.push({ name: 'validation', params: { id: projectId } })"
      >
        Aller en Validation →
      </button>
    </div>

    <CompareModal
      v-if="compare"
      :before="assetUrl(compare.before_path)"
      :after="assetUrl(compare.path)"
      :title="compare.title || ''"
      :protect="protect"
      @close="compare = null"
    />

    <AnnotateModal
      v-if="annotate"
      :media="annotate"
      :project-id="projectId"
      :protect="protect"
      @close="annotate = null"
    />

    <!-- Surlignage glisser-déposer -->
    <div
      v-if="isDragging && can.uploadMedia.value"
      class="pointer-events-none fixed inset-0 z-40 m-3 flex items-center justify-center border-4 border-dashed border-accent bg-surface/80 backdrop-blur-sm"
    >
      <span class="bg-accent px-6 py-3 text-xl font-bold tracking-tight text-canvas">
        Déposez vos photos ici
      </span>
    </div>
  </section>
</template>
