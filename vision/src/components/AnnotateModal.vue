<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { gsap } from "gsap";
import {
  imageCommentsFor,
  loadImageComments,
  addImageComment,
  removeImageComment,
  toggleResolved,
} from "../store/comments";
import { setApproval, setAlbum } from "../store/media";
import { session, can, ROLES } from "../store/session";
import { assetUrl } from "../services/files";
import { acquireScreenGuard, releaseScreenGuard } from "../services/screenGuard";
import { X, Check, RotateCcw, MapPin, Send, Lightbulb } from "lucide-vue-next";

const props = defineProps({
  media: { type: Object, required: true },
  projectId: { type: [String, Number], required: true },
  protect: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);

const draft = ref("");
const pendingPin = ref(null);
const loaded = ref(false);
const backdropRef = ref(null);
const imageAreaRef = ref(null);
const panelRef = ref(null);
let enterTl;

onMounted(() => {
  loadImageComments(props.media.id);
  window.addEventListener("keydown", onKey);
  if (props.protect) acquireScreenGuard();

  enterTl = gsap.timeline({ defaults: { ease: "power3.out" } })
    .fromTo(backdropRef.value, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 })
    .fromTo(imageAreaRef.value, { scale: 0.97, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3 }, "<0.05")
    .fromTo(panelRef.value, { x: 48, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.32 }, "<");
});

onUnmounted(() => {
  enterTl?.kill();
  window.removeEventListener("keydown", onKey);
  if (props.protect) releaseScreenGuard();
});

function onKey(e) {
  if (e.key === "Escape") emit("close");
}

const thread = computed(() => imageCommentsFor(props.media.id));
// Numérotation des annotations positionnées (épingles)
const pins = computed(() =>
  thread.value
    .filter((c) => c.x != null && c.y != null)
    .map((c, i) => ({ ...c, n: i + 1 }))
);

function onImageClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  pendingPin.value = {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
  };
}

async function send() {
  if (!draft.value.trim()) return;
  const p = pendingPin.value;
  await addImageComment(
    props.projectId,
    props.media.id,
    session.role,
    draft.value,
    p?.x ?? null,
    p?.y ?? null
  );
  draft.value = "";
  pendingPin.value = null;
}

function deletePin(p) {
  if (window.confirm("Supprimer cette annotation ?")) {
    removeImageComment(props.media.id, p.id);
  }
}

function confirmDelete(c) {
  if (window.confirm("Supprimer ce commentaire ?")) {
    removeImageComment(props.media.id, c.id);
  }
}

const roleLabel = (a) => (a === ROLES.CREATIF ? "Créatif" : "Client");

function approve(value) {
  setApproval(props.media, value);
}
function onAlbumInput(e) {
  setAlbum(props.media, e.target.value);
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="backdropRef"
      class="fixed inset-0 z-50 flex bg-black/85"
      @click="emit('close')"
    >
      <!-- Image + épingles (le fond ferme ; l'image, non) -->
      <div ref="imageAreaRef" class="flex flex-1 items-center justify-center p-6">
        <div class="relative max-h-full">
          <div v-if="!loaded" class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="animate-pulse bg-surface px-6 py-3 text-xl font-bold tracking-tight text-ink shadow-xl shadow-black/5 rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30/30">
              Chargement
            </span>
          </div>
          <img
            :src="assetUrl(media.path)"
            :alt="media.title || ''"
            draggable="false"
            decoding="async"
            class="max-h-[88vh] max-w-full cursor-crosshair select-none rounded-none-none object-contain transition-opacity duration-300"
            :class="loaded ? 'opacity-100' : 'opacity-0'"
            @load="loaded = true"
            @click.stop="onImageClick"
          />
          <!-- Épingles existantes — cliquables pour supprimer -->
          <button
            v-for="p in pins"
            :key="p.id"
            type="button"
            title="Cliquer pour supprimer cette annotation"
            class="group/pin absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-ink text-xs font-bold shadow shadow-black/5 transition hover:bg-rose-600 hover:text-white hover:border-rose-600"
            :class="p.resolved ? 'bg-emerald-500 text-ink opacity-70' : 'bg-accent text-canvas'"
            :style="{ left: p.x + '%', top: p.y + '%' }"
            @click.stop="deletePin(p)"
          >
            <span class="group-hover/pin:hidden">{{ p.n }}</span>
            <X class="hidden h-3 w-3 group-hover/pin:inline" />
          </button>
          <!-- Épingle en cours -->
          <span
            v-if="pendingPin"
            class="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse border-2 border-dashed border-ink bg-accent/60"
            :style="{ left: pendingPin.x + '%', top: pendingPin.y + '%' }"
          />
        </div>
      </div>

      <!-- Panneau latéral -->
      <aside
        ref="panelRef"
        class="flex w-80 shrink-0 flex-col border-l border-line bg-surface"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <p class="truncate text-sm font-medium">{{ media.title }}</p>
          <button
            type="button"
            class="flex items-center justify-center text-muted hover:text-ink"
            @click="emit('close')"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Validation par photo (client) -->
        <div
          v-if="can.validate.value"
          class="flex gap-2 border-b border-line px-4 py-3"
        >
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-1.5 rounded-none-none px-3 py-1.5 text-sm font-medium transition"
            :class="
              media.approval === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'shadow-sm shadow-black/5 rounded-none-none border border-line/30 hover:bg-white/5'
            "
            @click="approve('approved')"
          >
            <Check class="h-4 w-4" /> Approuver
          </button>
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-1.5 rounded-none-none px-3 py-1.5 text-sm font-medium transition"
            :class="
              media.approval === 'revise'
                ? 'bg-rose-600 text-white'
                : 'shadow-sm shadow-black/5 rounded-none-none border border-line/30 hover:bg-white/5'
            "
            @click="approve('revise')"
          >
            <RotateCcw class="h-4 w-4" /> À revoir
          </button>
        </div>
        <div
          v-else-if="media.approval"
          class="border-b border-line px-4 py-3 text-sm"
        >
          Décision client :
          <span
            :class="
              media.approval === 'approved'
                ? 'font-medium text-emerald-600'
                : 'font-medium text-rose-600'
            "
            >{{ media.approval === "approved" ? "Approuvée" : "À revoir" }}</span
          >
        </div>

        <!-- Album / étape (créatif) -->
        <div v-if="can.uploadMedia.value" class="border-b border-line px-4 py-3">
          <label class="mb-1 block text-[10px] uppercase tracking-widest font-semibold text-muted">Album / étape</label>
          <input
            :value="media.album || ''"
            placeholder="ex. Sélection, Retouche…"
            class="w-full rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 px-2 py-1 text-sm outline-none focus:border-accent"
            @change="onAlbumInput"
          />
        </div>

        <!-- Fil de commentaires / annotations -->
        <div class="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p class="flex items-start gap-1 text-[11px] text-muted">
            <Lightbulb class="h-3 w-3 mt-0.5 shrink-0" />
            <span>Ces commentaires concernent cette photo. Pour une discussion
            générale, utilisez l'onglet Feedback.</span>
          </p>
          <div
            v-for="c in thread"
            :key="c.id"
            class="border-2 border-ink bg-surface px-4 py-3 text-sm shadow-sm shadow-black/5"
            :class="c.resolved ? 'opacity-60 grayscale' : ''"
          >
            <div class="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-muted">
              <span
                v-if="c.x != null"
                class="flex h-5 w-5 items-center justify-center border-2 border-ink bg-accent text-[10px] font-bold text-canvas"
                >{{ pins.find((p) => p.id === c.id)?.n }}</span
              >
              <span class="font-medium text-ink">{{ roleLabel(c.author) }}</span>
              <span v-if="c.resolved" class="text-emerald-600">✓ Résolu</span>
            </div>
            <p class="leading-snug text-ink" :class="c.resolved ? 'line-through' : ''">
              {{ c.body }}
            </p>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                class="flex items-center gap-1 border-2 border-ink bg-surface px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink transition-transform hover:-translate-y-0.5 hover:shadow-md"
                @click="toggleResolved(media.id, c)"
              >
                <RotateCcw v-if="c.resolved" class="h-3 w-3" />
                <Check v-else class="h-3 w-3" />
                {{ c.resolved ? "Rouvrir" : "Résoudre" }}
              </button>
              <button
                type="button"
                class="flex items-center gap-1 border-2 border-rose-600 bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600 transition-transform hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-md"
                @click="confirmDelete(c)"
              >
                Supprimer
              </button>
            </div>
          </div>
          <p
            v-if="thread.length === 0"
            class="pt-6 text-center text-[10px] uppercase tracking-widest font-semibold text-muted"
          >
            Cliquez sur l'image pour épingler une remarque, ou écrivez ci-dessous.
          </p>
        </div>

        <!-- Saisie -->
        <form
          class="border-t border-line p-3"
          @submit.prevent="send"
        >
          <p
            v-if="pendingPin"
            class="mb-1 flex items-center justify-between text-xs font-medium text-accent"
          >
            <span class="flex items-center gap-1"><MapPin class="h-3 w-3" /> Annotation positionnée : décrivez votre remarque</span>
            <button
              type="button"
              class="text-muted hover:text-ink"
              @click="pendingPin = null"
            >
              annuler
            </button>
          </p>
          <div class="flex items-end gap-2">
            <textarea
              v-model="draft"
              rows="2"
              :placeholder="`Commenter en tant que ${roleLabel(session.role).toUpperCase()}...`"
              class="flex-1 resize-none border-2 border-ink bg-surface px-3 py-2 text-sm text-ink outline-none transition-transform focus:-translate-y-0.5 focus:shadow-md shadow-black/5 placeholder:text-muted"
              @keydown.enter.exact.prevent="send"
            />
            <button
              type="submit"
              :disabled="!draft.trim()"
              class="shrink-0 flex items-center justify-center border-2 border-ink bg-accent px-4 py-3 text-sm font-semibold text-canvas transition-all hover:-translate-y-0.5 hover:shadow-md shadow-black/5 disabled:pointer-events-none disabled:opacity-50"
            >
              <Send class="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  </Teleport>
</template>
