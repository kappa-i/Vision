<script setup>
import { computed, onMounted, ref } from "vue";
import {
  activeInvite,
  loadInvites,
  createInvite,
  regenerateInvite,
  isExpired,
} from "../store/invites";

const props = defineProps({
  projectId: { type: [String, Number], required: true },
});

const busy = ref(false);
const copied = ref(false);

onMounted(() => loadInvites(props.projectId));

const invite = computed(() => activeInvite(props.projectId));

const expiryLabel = computed(() => {
  const inv = invite.value;
  if (!inv || inv.accepted_at || !inv.expires_at) return null;
  const ms = new Date(inv.expires_at).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const hours = Math.ceil(ms / 3600000);
  return hours >= 24 ? `Expire dans ${Math.ceil(hours / 24)} j` : `Expire dans ${hours} h`;
});

async function generate() {
  busy.value = true;
  try {
    await createInvite(props.projectId);
  } finally {
    busy.value = false;
  }
}

async function regenerate() {
  busy.value = true;
  try {
    await regenerateInvite(props.projectId);
    copied.value = false;
  } finally {
    busy.value = false;
  }
}

async function copy() {
  if (!invite.value) return;
  try {
    await navigator.clipboard.writeText(invite.value.code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    /* clipboard indisponible */
  }
}
</script>

<template>
  <div class="rounded-none-none shadow-sm shadow-black/5 rounded-none-none border border-line/30 bg-surface p-4">
    <h3 class="text-sm font-medium">Inviter le client</h3>
    <p class="text-[10px] uppercase tracking-widest font-semibold text-muted">
      Un seul code par projet ; le client le saisit pour accéder au projet.
    </p>

    <!-- Code actif -->
    <div v-if="invite" class="mt-4 flex items-center gap-3">
      <code
        class="rounded-none-none bg-canvas px-3 py-2 text-base font-semibold tracking-[0.3em]"
        >{{ invite.code }}</code
      >
      <span
        v-if="invite.accepted_at"
        class="text-xs font-medium text-emerald-600"
        >Accepté ✓</span
      >
      <span
        v-else-if="isExpired(invite)"
        class="text-[10px] uppercase tracking-widest font-semibold text-rose-500"
        >Expiré, régénérez un code</span
      >
      <span v-else class="text-[10px] uppercase tracking-widest font-semibold text-muted">
        En attente<template v-if="expiryLabel"> · {{ expiryLabel }}</template>
      </span>

      <div class="ml-auto flex items-center gap-3">
        <button
          type="button"
          class="text-xs font-medium text-accent hover:underline"
          @click="copy"
        >
          {{ copied ? "Copié !" : "Copier" }}
        </button>
        <button
          type="button"
          :disabled="busy"
          class="text-[10px] uppercase tracking-widest font-semibold font-medium text-muted hover:text-ink disabled:opacity-50"
          @click="regenerate"
        >
          Régénérer
        </button>
      </div>
    </div>

    <!-- Aucun code encore -->
    <button
      v-else
      type="button"
      :disabled="busy"
      class="mt-4 border-2 border-ink bg-accent px-4 py-2 text-xs font-semibold tracking-wide text-canvas transition-all hover:-translate-y-0.5 hover:shadow-md shadow-black/5 disabled:pointer-events-none disabled:opacity-50"
      @click="generate"
    >
      {{ busy ? "…" : "Générer un code d'invitation" }}
    </button>
  </div>
</template>
