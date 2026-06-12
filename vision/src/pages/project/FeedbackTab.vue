<script setup>
import { ref, computed, onMounted, watch, nextTick } from "vue";
import gsap from "gsap";
import { useRoute } from "vue-router";
import {
  comments,
  commentsFor,
  loadComments,
  addComment,
  removeComment,
} from "../../store/comments";
import { session, currentProfile, can, ROLES } from "../../store/session";

const route = useRoute();
const projectId = computed(() => route.params.id);

const draft = ref("");
const sending = ref(false);

const thread = computed(() => commentsFor(projectId.value));
const threadRef = ref(null);

onMounted(() => {
  loadComments(projectId.value).then(() => {
    nextTick(() => {
      if (!document.querySelector(".feedback-message")) return;
      gsap.from(".feedback-message", {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: "back.out(1.5)"
      });
    });
  });
});

watch(() => thread.value.length, async (newLen, oldLen) => {
  if (newLen > oldLen) {
    await nextTick();
    const msgs = document.querySelectorAll(".feedback-message");
    const newMsg = msgs[msgs.length - 1];
    if (newMsg) {
      gsap.fromTo(newMsg,
        { y: 20, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }
      );
      if (threadRef.value) {
        threadRef.value.scrollTo({ top: threadRef.value.scrollHeight, behavior: 'smooth' });
      }
    }
  }
});

async function send() {
  if (!draft.value.trim() || sending.value) return;
  sending.value = true;
  try {
    await addComment(projectId.value, session.role, draft.value);
    draft.value = "";
  } finally {
    sending.value = false;
  }
}

const roleLabel = (a) => {
  if (a === session.role && currentProfile.value?.name) {
    return currentProfile.value.name;
  }
  return a === ROLES.CREATIF ? "Créatif" : "Client";
};


function formatDate(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}
</script>

<template>
  <section class="mx-auto flex h-full max-w-4xl flex-col">
    <div class="mb-8">
      <h2 class="text-2xl font-bold tracking-tight text-ink">Feedback</h2>
      <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
        Discussion générale du projet. Pour commenter une photo précise, ouvrez-la dans la Galerie.
      </p>
    </div>

    <!-- Fil -->
    <div ref="threadRef" class="flex-1 space-y-8 overflow-y-auto pb-8 pr-4">
      <div
        v-for="c in thread"
        :key="c.id"
        class="feedback-message flex gap-4"
        :class="c.author === ROLES.CREATIF ? 'flex-row' : 'flex-row-reverse'"
      >
        <!-- Avatar brutaliste -->
        <div 
          class="flex h-10 w-10 shrink-0 items-center justify-center border border-line/30 rounded-none-none shadow-sm font-bold tracking-tight"
          :class="c.author === ROLES.CREATIF ? 'bg-surface text-ink' : 'bg-accent text-canvas'"
          :title="roleLabel(c.author)"
        >
          {{ roleLabel(c.author).substring(0, 2).toUpperCase() }}
        </div>

        <!-- Bulle -->
        <div
          class="relative max-w-[80%] border border-line/30 rounded-none-none shadow-sm p-4 shadow-md shadow-black/5"
          :class="c.author === ROLES.CREATIF ? 'bg-surface' : 'bg-accent text-canvas'"
        >
          <div
            class="mb-3 flex items-center justify-between border-b-2 pb-2"
            :class="c.author === ROLES.CREATIF ? 'border-line text-muted' : 'border-canvas/20 text-canvas/80'"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold tracking-tight">{{ roleLabel(c.author) }}</span>
              <span class="text-[10px] font-semibold tracking-wide">{{ formatDate(c.created_at) }}</span>
            </div>
          </div>
          <p class="whitespace-pre-wrap text-sm font-medium leading-relaxed">{{ c.body }}</p>
        </div>
      </div>

      <div
        v-if="comments.loaded[projectId] && thread.length === 0"
        class="flex flex-col items-center justify-center border-2 border-dashed border-line/30 rounded-none-none bg-surface/50 backdrop-blur-sm py-24 text-center"
      >
        <span class="text-xl font-bold tracking-tight text-muted">
          Aucun commentaire pour l'instant. Lancez la discussion.
        </span>
      </div>
    </div>

    <!-- Saisie (les deux rôles peuvent commenter — §6) -->
    <form
      v-if="can.comment.value"
      class="mt-6 flex flex-col gap-2 border-t-2 border-line pt-4 sm:flex-row"
      @submit.prevent="send"
    >
      <textarea
        v-model="draft"
        rows="1"
        :placeholder="`Commenter en tant que ${roleLabel(session.role).toUpperCase()}…`"
        class="flex-1 resize-none border-2 border-ink bg-surface px-3 py-2 text-sm text-ink outline-none transition-transform focus:-translate-y-0.5 focus:shadow-md shadow-black/5 placeholder:text-muted"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="submit"
        :disabled="!draft.trim() || sending"
        class="shrink-0 border-2 border-ink bg-accent px-4 py-2 text-[10px] font-semibold tracking-wide text-canvas transition-all hover:-translate-y-0.5 hover:shadow-md shadow-black/5 disabled:pointer-events-none disabled:opacity-50"
      >
        Envoyer
      </button>
    </form>
  </section>
</template>
