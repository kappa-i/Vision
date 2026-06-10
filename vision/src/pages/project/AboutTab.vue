<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch, nextTick } from "vue";
import { gsap } from "gsap";
import { useRoute } from "vue-router";
import {
  projects,
  loadProjects,
  findProject,
  updateProjectMeta,
  setCover,
  STATUS,
  STATUS_LABEL,
} from "../../store/projects";
import { mediaFor, loadMedia } from "../../store/media";
import { validationsFor, loadValidations } from "../../store/validations";
import {
  unresolvedFor,
  loadUnresolvedAnnotations,
} from "../../store/comments";
import { assetUrl } from "../../services/files";
import { can } from "../../store/session";
import { useRouter } from "vue-router";
import { Check, ArrowRight, MessageCircle, Image as ImageIcon } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const projectId = computed(() => route.params.id);

const name = ref("");
const description = ref("");
const descTextarea = ref(null);

function resizeTextarea() {
  if (descTextarea.value) {
    descTextarea.value.style.height = 'auto';
    descTextarea.value.style.height = descTextarea.value.scrollHeight + 'px';
  }
}
const saved = ref(false);

onMounted(async () => {
  if (!projects.loaded) await loadProjects();
  loadMedia(projectId.value, "gallery");
  loadValidations(projectId.value);
  loadUnresolvedAnnotations(projectId.value);
  sync();
});

const unresolved = computed(() => unresolvedFor(projectId.value));
const totalUnresolved = computed(() =>
  unresolved.value.reduce((s, r) => s + Number(r.count), 0)
);

const project = computed(() => findProject(projectId.value));
const gallery = computed(() => mediaFor(projectId.value, "gallery"));

const tally = computed(() => {
  const t = { total: gallery.value.length, approved: 0, revise: 0, pending: 0 };
  for (const m of gallery.value) {
    if (m.approval === "approved") t.approved++;
    else if (m.approval === "revise") t.revise++;
    else t.pending++;
  }
  return t;
});

const phase = computed(() => {
  const s = project.value?.status;
  const classes = {
    [STATUS.DELIVERED]: "bg-indigo-300 text-indigo-950 border-2 border-indigo-950",
    [STATUS.VALIDATED]: "bg-emerald-300 text-emerald-950 border-2 border-emerald-950",
    [STATUS.REVISE]: "bg-rose-300 text-rose-950 border-2 border-rose-950",
  };
  if (s === STATUS.DELIVERED) return { label: "Livré", cls: classes[s] };
  if (s === STATUS.VALIDATED) return { label: "Validé : prêt à livrer", cls: classes[s] };
  if (s === STATUS.REVISE) return { label: "En révision", cls: classes[s] };
  if (gallery.value.length) return { label: "Sélection en cours", cls: "bg-amber-300 text-amber-950 border-2 border-amber-950" };
  return { label: "Brief", cls: "bg-surface text-ink border-2 border-ink" };
});

const nextAction = computed(() => {
  const s = project.value?.status;
  if (can.uploadMedia.value) {
    if (s === STATUS.DELIVERED) return "Projet livré.";
    if (s === STATUS.REVISE) return "Des photos sont à revoir : corrigez puis ré-uploadez.";
    if (s === STATUS.VALIDATED) return "Sélection validée : remettez les fichiers depuis Livraison.";
    if (!gallery.value.length) return "Uploadez l'avancement dans la Galerie.";
    return "En attente de la validation du client.";
  }
  if (s === STATUS.DELIVERED) return "Vos fichiers sont disponibles dans Livraison.";
  if (s === STATUS.VALIDATED) return "Sélection validée : en attente de la remise des fichiers.";
  if (s === STATUS.REVISE) return "Révision demandée : le créatif retravaille la sélection.";
  if (gallery.value.length) return "À vous de juger les photos dans la Galerie.";
  return "Le créatif prépare votre projet.";
});

const counts = reactive({ total: 0, approved: 0, revise: 0, pending: 0 });
let countTween;
watch(tally, (t) => {
  countTween?.kill();
  countTween = gsap.to(counts, {
    total: t.total,
    approved: t.approved,
    revise: t.revise,
    pending: t.pending,
    duration: 0.9,
    ease: "power2.out",
    snap: { total: 1, approved: 1, revise: 1, pending: 1 },
  });
}, { immediate: true });

onUnmounted(() => countTween?.kill());

function sync() {
  name.value = project.value?.name || "";
  description.value = project.value?.description || "";
  nextTick(resizeTextarea);
}
watch(project, sync);

async function save() {
  await updateProjectMeta(projectId.value, name.value, description.value);
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}

function formatDate(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
</script>

<template>
  <div class="relative min-h-full pb-24 pt-8">
    <div class="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12">
      
      <!-- Colonne Affiche + Contenu -->
      <div class="lg:col-span-8 flex flex-col md:flex-row gap-8 items-start">
        
        <!-- Affiche (Poster) -->
        <div class="group relative w-full md:w-2/5 shrink-0 aspect-[4/5] overflow-hidden border-2 border-ink bg-surface shadow-sm">
          <img
            v-if="project?.cover_path"
            :src="assetUrl(project.cover_path)"
            class="h-full w-full object-cover"
          />
          <div v-else class="flex h-full flex-col items-center justify-center bg-canvas p-6 text-center">
            <span class="text-[10px] uppercase tracking-widest text-muted font-bold">L'Affiche du projet</span>
          </div>
          
          <!-- Bouton changer couverture (au survol) -->
          <button
            v-if="can.createProject.value"
            type="button"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-max items-center gap-2 border-2 border-ink bg-surface px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-ink opacity-0 transition-all hover:-translate-y-0.5 hover:shadow-md group-hover:opacity-100"
            @click="setCover(projectId)"
          >
            <ImageIcon class="h-4 w-4" />
            Modifier
          </button>
        </div>

        <!-- Titre et Brief -->
        <div class="flex-1 w-full">
          <form @submit.prevent="save" v-if="can.createProject.value">
            <input
              v-model="name"
              @blur="save"
              placeholder="Titre du projet"
              class="w-full bg-transparent px-0 text-5xl font-black leading-none tracking-tighter uppercase text-ink outline-none placeholder:text-muted/50 border-b-2 border-transparent hover:border-line focus:border-ink transition-all"
            />
            <textarea
              ref="descTextarea"
              v-model="description"
              @blur="save"
              @input="resizeTextarea"
              rows="1"
              style="min-height: 4rem"
              placeholder="Décrivez l'objectif, l'ambiance, les livrables attendus..."
              class="mt-8 w-full resize-none overflow-hidden bg-transparent text-lg leading-relaxed text-ink outline-none placeholder:text-muted/50 border-b-2 border-line focus:border-ink transition-all"
            ></textarea>
            <div class="mt-4 flex items-center h-6">
               <span v-if="saved" class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-500 transition-opacity">
                 <Check class="h-4 w-4" /> Enregistré
               </span>
            </div>
          </form>

          <div v-else>
             <h1 class="text-5xl font-black leading-none tracking-tighter uppercase text-ink">{{ project?.name }}</h1>
             <p class="mt-8 whitespace-pre-line text-lg leading-relaxed text-ink">{{ project?.description || "Aucun brief fourni par le créatif." }}</p>
          </div>
        </div>
      </div>

      <!-- Sidebar (Méta, Statut, Compteurs) -->
      <div class="lg:col-span-4 space-y-8">
        <!-- Statut & Prochaine action -->
        <div class="border-4 border-ink bg-surface p-6 shadow-sm">
          <p class="text-[10px] font-black uppercase tracking-widest text-ink">Statut du projet</p>
          <div class="mt-4 inline-block px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all" :class="phase.cls">
            {{ phase.label }}
          </div>
          
          <div class="my-8 h-1 w-12 bg-ink"></div>
          
          <p class="text-[10px] font-black uppercase tracking-widest text-ink">Prochaine action</p>
          <p class="mt-4 flex items-start gap-2 text-base font-bold text-ink leading-tight">
            <ArrowRight class="h-5 w-5 shrink-0 text-ink mt-0.5" />
            <span>{{ nextAction }}</span>
          </p>
        </div>

        <!-- Compteurs -->
        <div v-if="tally.total" class="grid grid-cols-2 gap-4">
           <div class="border-2 border-ink bg-surface p-4 text-center shadow-sm">
             <p class="text-4xl font-black tracking-tighter">{{ counts.total }}</p>
             <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Photos</p>
           </div>
           <div class="border-2 border-ink bg-surface p-4 text-center shadow-sm">
             <p class="text-4xl font-black tracking-tighter text-emerald-600">{{ counts.approved }}</p>
             <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Approuvées</p>
           </div>
           <div class="border-2 border-ink bg-surface p-4 text-center shadow-sm">
             <p class="text-4xl font-black tracking-tighter text-muted">{{ counts.pending }}</p>
             <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">Non jugées</p>
           </div>
           <div class="border-2 border-ink bg-surface p-4 text-center shadow-sm">
             <p class="text-4xl font-black tracking-tighter text-rose-600">{{ counts.revise }}</p>
             <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">À revoir</p>
           </div>
        </div>

        <!-- Annotations non résolues -->
        <div v-if="can.uploadMedia.value && totalUnresolved > 0" class="border-2 border-amber-500 bg-amber-50 p-6 shadow-sm">
           <p class="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wide">
             <MessageCircle class="h-4 w-4 shrink-0" /> {{ totalUnresolved }} annotations
           </p>
           <div class="mt-4 flex flex-wrap gap-2">
             <button
               v-for="r in unresolved"
               :key="r.media_id"
               type="button"
               class="relative cursor-pointer border-2 border-amber-300 transition-transform hover:-translate-y-0.5 hover:shadow-md hover:border-amber-500"
               :title="r.title"
               @click="router.push({ name: 'gallery', params: { id: projectId } })"
             >
               <img v-if="r.thumb_path" :src="assetUrl(r.thumb_path)" class="h-10 w-10 object-cover" />
               <div v-else class="h-10 w-10 bg-white/10" />
               <span class="absolute bottom-0 right-0 bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black">{{ r.count }}</span>
             </button>
           </div>
        </div>

        <!-- Méta dates -->
          <div class="border-4 border-ink bg-surface p-6 shadow-sm mt-8">
             <dl class="space-y-4">
               <div>
                 <dt class="text-[10px] font-black uppercase tracking-widest text-ink">Création du projet</dt>
                 <dd class="mt-2 text-base font-bold text-ink">{{ formatDate(project?.created_at) }}</dd>
               </div>
             </dl>
          </div>
      </div>
    </div>
  </div>
</template>
