<script setup>
import { computed, onMounted, ref, onUnmounted, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);
import {
  mediaFor,
  loadMedia,
  uploadMedia,
  addPaths,
  removeMedia,
  setAlbum,
  setTitle,
  reorderMedia,
} from "../../store/media";
import { pickImages } from "../../services/files";
import { assetUrl } from "../../services/files";
import { can } from "../../store/session";
import Lightbox from "../../components/Lightbox.vue";
import { useFileDrop } from "../../composables/useFileDrop";

const route = useRoute();
const projectId = computed(() => route.params.id);
const KIND = "moodboard";
const busy = ref(false);
const preview = ref(null);
const cols = ref(3);

const explicitAlbums = ref([]);
const showFolderModal = ref(false);
const newFolderName = ref("");

const editingTitleId = ref(null);
const titleDraft = ref("");

onMounted(() => {
  loadMedia(projectId.value, KIND);
  const saved = localStorage.getItem(`moodboard_albums_${projectId.value}`);
  if (saved) explicitAlbums.value = JSON.parse(saved);

  window.addEventListener("dragover", preventDefault);
  window.addEventListener("drop", handleGlobalDrop);
  window.addEventListener("paste", handlePaste);
  
  nextTick(() => initDraggables());
});

onUnmounted(() => {
  window.removeEventListener("dragover", preventDefault);
  window.removeEventListener("drop", handleGlobalDrop);
  window.removeEventListener("paste", handlePaste);
});

watch(explicitAlbums, (val) => {
  localStorage.setItem(`moodboard_albums_${projectId.value}`, JSON.stringify(val));
}, { deep: true });

const items = computed(() => mediaFor(projectId.value, KIND));

const grouped = computed(() => {
  const map = new Map();
  // Ensure explicit albums exist even if empty
  for (const a of explicitAlbums.value) {
    if (!map.has(a)) map.set(a, []);
  }
  // Add items to their respective albums
  for (const m of items.value) {
    const k = m.album || "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  }
  
  // Sort items within each folder by position then created_at
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (a.position !== b.position) return (a.position || 0) - (b.position || 0);
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  return [...map.entries()]
    .sort((a, b) =>
      a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])
    )
    .map(([album, list]) => ({ album: album || "Général", isGeneral: album === "", items: list }));
});

watch(grouped, () => {
  nextTick(() => initDraggables());
}, { deep: true });

let draggables = [];
let currentHoveredFolder = null;

function initDraggables() {
  draggables.forEach(d => d.kill());
  draggables = [];
  if (!can.editMoodboard.value) return;

  const itemsEls = document.querySelectorAll(".moodboard-item");
  itemsEls.forEach(itemEl => {
    const d = Draggable.create(itemEl, {
      type: "x,y",
      trigger: itemEl.querySelector(".drag-handle"),
      zIndexBoost: true,
      edgeResistance: 0.8,
      onDragStart: function() {
        gsap.to(this.target, { scale: 1.05, duration: 0.2, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" });
      },
      onDrag: function(e) {
        const folders = document.querySelectorAll(".moodboard-folder");
        let hit = null;
        for (const folder of folders) {
          if (this.hitTest(folder, "pointer")) {
            hit = folder;
            break;
          }
        }
        
        if (currentHoveredFolder !== hit) {
          if (currentHoveredFolder) {
            currentHoveredFolder.classList.remove("border-accent", "bg-accent/5", "shadow-[0_0_0_2px]", "shadow-accent");
            currentHoveredFolder.classList.add("border-line/50", "bg-surface/30");
          }
          currentHoveredFolder = hit;
          if (currentHoveredFolder) {
            currentHoveredFolder.classList.add("border-accent", "bg-accent/5", "shadow-[0_0_0_2px]", "shadow-accent");
            currentHoveredFolder.classList.remove("border-line/50", "bg-surface/30");
          }
        }

        // Drop indicator logic
        // First hide all drop indicators
        document.querySelectorAll(".drop-indicator").forEach(ind => {
            ind.style.opacity = "0";
        });

        let hitItem = null;
        const allItemsEls = document.querySelectorAll(".moodboard-item");
        for (const el of allItemsEls) {
          if (el !== this.target && this.hitTest(el, "pointer")) {
            hitItem = el;
            break;
          }
        }

        if (hitItem) {
          // Check if dragging inside the same folder before showing indicator
          const dragId = this.target.dataset.id;
          const targetId = hitItem.dataset.id;
          const dragMedia = items.value.find(m => String(m.id) === String(dragId));
          const targetMedia = items.value.find(m => String(m.id) === String(targetId));

          if (dragMedia && targetMedia && dragMedia.album === targetMedia.album) {
            const rect = hitItem.getBoundingClientRect();
            const isLeft = this.pointerX < rect.left + rect.width / 2;
            
            const parent = hitItem.parentElement;
            const indicator = parent.querySelector(".drop-indicator");
            
            if (indicator) {
                const parentStyles = window.getComputedStyle(parent);
                const gap = parseFloat(parentStyles.columnGap) || 16;
                const gapHalf = gap / 2;
                const indicatorWidth = indicator.offsetWidth || 4;
                
                const leftPos = isLeft ? (hitItem.offsetLeft - gapHalf - indicatorWidth / 2) : (hitItem.offsetLeft + hitItem.offsetWidth + gapHalf - indicatorWidth / 2);
                
                indicator.style.left = `${leftPos}px`;
                indicator.style.top = `${hitItem.offsetTop}px`;
                indicator.style.height = `${hitItem.offsetHeight}px`;
                indicator.style.opacity = "1";
            }
          }
        }
      },
      onDragEnd: function(e) {
        document.querySelectorAll(".drop-indicator").forEach(ind => {
            ind.style.opacity = "0";
        });

        if (currentHoveredFolder) {
          currentHoveredFolder.classList.remove("border-accent", "bg-accent/5", "shadow-[0_0_0_2px]", "shadow-accent");
          currentHoveredFolder.classList.add("border-line/50", "bg-surface/30");
        }

        let droppedFolder = currentHoveredFolder ? currentHoveredFolder.dataset.album : null;
        currentHoveredFolder = null;
        
        const pointerX = this.pointerX;
        const dragId = this.target.dataset.id;
        const dragMedia = items.value.find(m => String(m.id) === String(dragId));
        if (!dragMedia) return;

        let droppedOnItem = null;
        const allItemsEls = document.querySelectorAll(".moodboard-item");
        for (const el of allItemsEls) {
          if (el !== this.target && this.hitTest(el, "pointer")) {
            droppedOnItem = el;
            break;
          }
        }

        // 1. Same-folder reordering
        if (droppedOnItem) {
          const targetId = droppedOnItem.dataset.id;
          const targetMedia = items.value.find(m => String(m.id) === String(targetId));
          
          if (targetMedia && dragMedia.album === targetMedia.album) {
            const folderItems = items.value
              .filter(m => m.album === dragMedia.album)
              .sort((a, b) => (a.position || 0) - (b.position || 0));
              
            const fromIndex = folderItems.findIndex(m => m.id === dragMedia.id);
            const toIndex = folderItems.findIndex(m => m.id === targetMedia.id);
            
            if (fromIndex !== -1 && toIndex !== -1) {
              const rect = droppedOnItem.getBoundingClientRect();
              const isLeft = pointerX < rect.left + rect.width / 2;
              
              folderItems.splice(fromIndex, 1);
              let insertIndex = folderItems.findIndex(m => m.id === targetMedia.id);
              if (!isLeft) insertIndex += 1;
              
              folderItems.splice(insertIndex, 0, dragMedia);
              
              // Clear GSAP immediately so it doesn't animate back to its old physical position
              gsap.set(this.target, { clearProps: "x,y,scale,opacity,boxShadow,zIndex" });
              
              reorderMedia(projectId.value, KIND, folderItems.map(m => m.id));
              return;
            }
          }
        }

        // 2. Different folder drop or Miss
        let movingToNewFolder = false;
        let newAlbum = dragMedia.album;

        if (droppedOnItem) {
            const targetId = droppedOnItem.dataset.id;
            const targetMedia = items.value.find(m => String(m.id) === String(targetId));
            if (targetMedia && dragMedia.album !== targetMedia.album) {
                movingToNewFolder = true;
                newAlbum = targetMedia.album;
            }
        } else if (droppedFolder !== null) {
            newAlbum = droppedFolder === "Général" ? null : droppedFolder;
            if (dragMedia.album !== newAlbum) {
                movingToNewFolder = true;
            }
        }

        if (movingToNewFolder) {
            gsap.to(this.target, { scale: 0, opacity: 0, duration: 0.2, onComplete: () => {
                gsap.set(this.target, { clearProps: "all" });
                setAlbum(dragMedia, newAlbum);
            }});
        } else {
            // Snap back to original position (it didn't move folders, didn't hit anything)
            gsap.to(this.target, { scale: 1, duration: 0.2, boxShadow: "none", x: 0, y: 0, clearProps: "x,y,scale,opacity,boxShadow,zIndex" });
        }
      }
    });
    draggables.push(d[0]);
  });
}

function openFolderModal() {
  newFolderName.value = "";
  showFolderModal.value = true;
}

function closeFolderModal() {
  showFolderModal.value = false;
}

function submitFolder() {
  const name = newFolderName.value;
  if (name && name.trim()) {
    const clean = name.trim();
    if (!explicitAlbums.value.includes(clean)) {
      explicitAlbums.value.push(clean);
    }
  }
  closeFolderModal();
}

function removeFolder(name) {
  if (window.confirm(`Supprimer le dossier "${name}" ? Les images retourneront dans "Général".`)) {
    explicitAlbums.value = explicitAlbums.value.filter(a => a !== name);
    // Move items to general
    for (const m of items.value) {
      if (m.album === name) setAlbum(m, null);
    }
  }
}

// Suppression du state HTML5 drag local

function handleFolderDrop(event, targetAlbum) {
  event.preventDefault();
  event.stopPropagation(); // Stop global drop
  
  // S'il s'agit d'un lien HTML externe déposé directement dans un dossier
  if (!can.editMoodboard.value) return;
  const html = event.dataTransfer.getData("text/html");
  const url = event.dataTransfer.getData("URL");

  let imageUrl = null;
  if (html) {
    const match = html.match(/src=["'](.*?)["']/);
    if (match) imageUrl = match[1];
  } else if (url) {
    imageUrl = url;
  }

  if (imageUrl && /^https?:\/\//.test(imageUrl)) {
    addPaths(projectId.value, KIND, [imageUrl], targetAlbum === "Général" ? null : targetAlbum).then(() => {
      // Pourrait être amélioré pour l'assigner directement au dossier,
      // mais nécessite de modifier addPaths pour accepter l'album.
      // Pour l'instant on prévient l'utilisateur.
    });
  }
}

function handleGlobalDrop(event) {
  event.preventDefault();
  handleFolderDrop(event, "Général");
}

const { isDragging } = useFileDrop((paths) => {
  if (can.editMoodboard.value) addPaths(projectId.value, KIND, paths, null);
});

function handlePaste(event) {
  if (!can.editMoodboard.value) return;
  const html = event.clipboardData.getData("text/html");
  const url = event.clipboardData.getData("text/plain");

  let imageUrl = null;
  if (html) {
    const match = html.match(/src=["'](.*?)["']/);
    if (match) imageUrl = match[1];
  } else if (url && /^https?:\/\//.test(url)) {
    imageUrl = url;
  }

  if (imageUrl && /^https?:\/\//.test(imageUrl)) {
    addPaths(projectId.value, KIND, [imageUrl], null);
  }
}

function preventDefault(e) { e.preventDefault(); }

async function add(album = null) {
  busy.value = true;
  try {
    const paths = await pickImages();
    if (paths && paths.length) {
      await addPaths(projectId.value, KIND, paths, typeof album === 'string' ? album : null);
    }
  } finally {
    busy.value = false;
  }
}

function confirmRemove(m) {
  if (window.confirm(`Retirer « ${m.title} » ?`)) {
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
</script>

<template>
  <section class="mx-auto max-w-4xl">
    <div class="mb-8 flex items-end justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-ink">Direction artistique</h2>
        <p class="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
          Références visuelles posées par le créatif.
        </p>
      </div>
      <div class="flex items-center gap-4">
        <button
          v-if="can.editMoodboard.value"
          type="button"
          class="rounded bg-surface px-4 py-1.5 text-sm font-semibold text-ink shadow-sm ring-1 ring-inset ring-line hover:bg-ink/5"
          @click="openFolderModal"
        >
          Créer un dossier
        </button>
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
      </div>
    </div>

    <div v-if="items.length || explicitAlbums.length" class="space-y-12">
      <div 
        v-for="g in grouped" 
        :key="g.album"
        class="moodboard-folder rounded-xl border border-dashed border-line/50 bg-surface/30 p-6 transition-colors"
        :data-album="g.album"
        @dragover.prevent
        @drop="handleFolderDrop($event, g.album)"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
            <svg class="h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {{ g.album }}
            <span class="ml-2 text-xs font-normal text-muted">({{ g.items.length }})</span>
          </h3>
          <div class="flex items-center gap-2">
            <button
              v-if="can.editMoodboard.value"
              type="button"
              class="rounded bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm ring-1 ring-inset ring-line hover:bg-ink/5 transition"
              @click="add(g.isGeneral ? null : g.album)"
            >
              Ajouter ici
            </button>
            <button
              v-if="can.editMoodboard.value && !g.isGeneral"
            type="button"
            title="Supprimer le dossier"
            class="text-muted hover:text-rose-500"
            @click="removeFolder(g.album)"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          </div>
        </div>

        <div v-if="g.items.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
          <span class="text-sm font-medium text-muted">Dossier vide.</span>
        </div>

        <div v-else class="relative grid gap-4" :class="cols === 2 ? 'grid-cols-2' : 'grid-cols-3'">
          <div class="drop-indicator pointer-events-none absolute z-50 w-1 rounded-full bg-accent opacity-0 transition-opacity duration-100 shadow-[0_0_8px_rgba(var(--color-accent),0.5)]"></div>
          <figure
            v-for="m in g.items"
            :key="m.id"
            :data-id="m.id"
            class="moodboard-item group relative cv-auto overflow-hidden rounded-none-none shadow-sm shadow-black/5 border border-line/30 bg-surface"
          >
            <div
              v-if="can.editMoodboard.value"
              class="drag-handle absolute left-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded bg-black/60 text-white cursor-grab active:cursor-grabbing group-hover:flex hover:bg-black/80 z-10"
              title="Déplacer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip"><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/><circle cx="5" cy="19" r="1"/></svg>
            </div>
            <img
              v-if="m.thumb_path"
              :src="assetUrl(m.thumb_path)"
              :alt="m.title || ''"
              :draggable="false"
              loading="lazy"
              decoding="async"
              class="aspect-square w-full cursor-zoom-in select-none bg-canvas object-cover"
              @click="preview = m"
              @contextmenu.prevent
            />
            <div
              v-else
              class="aspect-square w-full animate-pulse cursor-wait bg-canvas"
              title="Miniature en cours de génération…"
              @click="preview = m"
            />
            <figcaption
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-xs text-white"
              :class="can.editMoodboard.value && editingTitleId !== m.id ? 'cursor-text hover:bg-black/60' : ''"
              @click.stop="can.editMoodboard.value && startEditTitle(m)"
              :title="can.editMoodboard.value ? 'Renommer' : ''"
            >
              <input
                v-if="can.editMoodboard.value && editingTitleId === m.id"
                :value="titleDraft"
                class="w-full border-b border-accent bg-transparent text-white outline-none"
                @input="titleDraft = $event.target.value"
                @blur="commitTitle(m)"
                @keydown.enter.prevent="commitTitle(m)"
                @keydown.escape="editingTitleId = null"
                @click.stop
                :ref="el => el && el.focus()"
              />
              <span v-else class="block w-full truncate">{{ m.title }}</span>
            </figcaption>
            <button
              v-if="can.editMoodboard.value"
              type="button"
              title="Retirer du moodboard"
              class="absolute right-1.5 top-1.5 hidden h-6 w-6 rounded-none-full bg-black/60 text-xs text-white group-hover:block hover:bg-rose-500"
              @click.stop="confirmRemove(m)"
            >
              ✕
            </button>
          </figure>
        </div>
      </div>
    </div>

    <div
      v-else
      class="flex flex-col items-center justify-center border-2 border-dashed border-line py-24 text-center transition hover:border-ink hover:bg-ink/5"
    >
      <span class="text-xl font-bold tracking-tight text-muted">
        {{
          can.editMoodboard.value
            ? "Aucune référence. Créez un dossier pour commencer."
            : "Aucune direction artistique posée."
        }}
      </span>
    </div>

    <Lightbox
      v-if="preview"
      :src="assetUrl(preview.path)"
      :alt="preview.title || ''"
      @close="preview = null"
    />

    <!-- Surlignage glisser-déposer -->
    <div
      v-if="isDragging && can.editMoodboard.value"
      class="pointer-events-none fixed inset-0 z-40 m-3 border-4 border-dashed border-accent bg-surface/20 backdrop-blur-sm transition-all"
    >
    </div>

    <!-- Modale de création de dossier -->
    <div v-if="showFolderModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-sm rounded-xl border border-line/30 bg-surface p-6 shadow-2xl">
        <h3 class="mb-4 text-xl font-bold tracking-tight text-ink">Nouveau dossier</h3>
        <form @submit.prevent="submitFolder">
          <input
            v-model="newFolderName"
            type="text"
            placeholder="Nom du dossier..."
            class="mb-6 w-full rounded bg-canvas px-4 py-2 text-ink shadow-inner outline-none ring-1 ring-inset ring-line/50 focus:ring-2 focus:ring-accent"
            autoFocus
          />
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded px-4 py-2 text-sm font-bold text-muted transition hover:bg-line/20 hover:text-ink"
              @click="closeFolderModal"
            >
              Annuler
            </button>
            <button
              type="submit"
              class="rounded bg-ink px-4 py-2 text-sm font-bold text-canvas shadow-md transition hover:bg-ink/90 hover:shadow-lg active:scale-95"
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>
