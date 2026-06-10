<script setup>
import { ref } from "vue";
import { session } from "../store/session";
import { auth, updateProfile, signOut, deleteAccount } from "../services/auth";
import { isTauri } from "../services/db";
import { useRouter } from "vue-router";
import { Check } from "lucide-vue-next";

const router = useRouter();
const name = ref(auth.profile?.name || "");
const saved = ref(false);
const error = ref("");
const showDeleteConfirm = ref(false);

async function saveProfile() {
  error.value = "";
  try {
    await updateProfile({ name: name.value });
    saved.value = true;
    setTimeout(() => (saved.value = false), 1500);
  } catch (e) {
    error.value = e.message;
  }
}

async function handleSignOut() {
  await signOut();
  router.push({ name: "auth" });
}

import { toast } from "../store/toast";

async function executeDelete() {
  showDeleteConfirm.value = false;
  toast("Votre compte a été définitivement supprimé.", "success");
  await deleteAccount();
  router.push({ name: "auth" });
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-8 py-10">
    <header class="mb-12 border-b-4 border-ink pb-8">
      <h1 class="text-4xl font-black uppercase tracking-tighter text-ink">Paramètres</h1>
      <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">Profil, invitations et préférences.</p>
    </header>

    <!-- Profil / identité -->
    <section class="mt-8">
      <h2 class="mb-6 text-sm font-black uppercase tracking-widest text-ink">Profil</h2>
      <form
        class="space-y-6 border-4 border-ink bg-surface p-8 shadow-sm"
        @submit.prevent="saveProfile"
      >
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-ink">Nom</label>
          <input
            v-model="name"
            placeholder="Votre nom"
            class="w-full border-2 border-ink bg-canvas px-4 py-3 text-base font-bold text-ink outline-none placeholder:text-muted/30 focus:border-ink focus:shadow-sm transition-all"
          />
        </div>
        <div>
          <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-ink">Email</label>
          <input
            :value="auth.user?.email"
            disabled
            class="w-full border-2 border-ink bg-canvas/50 px-4 py-3 text-base font-bold text-muted outline-none cursor-not-allowed"
          />
        </div>
        <div class="flex items-center gap-4 pt-4 border-t-2 border-line">
          <button
            type="submit"
            class="border-2 border-ink bg-accent px-6 py-3 text-xs font-black uppercase tracking-widest text-canvas transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Enregistrer
          </button>
          <span v-if="saved" class="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
            <Check class="h-4 w-4" /> Enregistré
          </span>
          <span v-else-if="error" class="text-xs font-bold uppercase tracking-widest text-rose-600">{{ error }}</span>
        </div>
      </form>
    </section>

    <!-- Déconnexion / Danger -->
    <section class="mt-16 flex flex-col sm:flex-row items-start sm:items-center justify-between border-t-4 border-ink pt-8 gap-8">
      <div>
        <button
          type="button"
          class="border-2 border-ink bg-surface px-6 py-3 text-xs font-black uppercase tracking-widest text-ink transition-all hover:-translate-y-0.5 hover:shadow-md"
          @click="handleSignOut"
        >
          Se déconnecter
        </button>
      </div>

      <div class="text-right w-full sm:w-auto">
        <button
          type="button"
          class="w-full sm:w-auto border-2 border-rose-600 bg-rose-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
          @click="showDeleteConfirm = true"
        >
          Supprimer le compte
        </button>
        <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-rose-600/70">
          Action irréversible
        </p>
      </div>
    </section>

    <!-- Modal de confirmation de suppression -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
    >
      <div class="w-full max-w-md border-4 border-ink bg-surface p-8 shadow-sm">
        <div class="mb-6 text-ink">
          <h3 class="text-xl font-black uppercase tracking-tighter">Suppression du compte</h3>
        </div>
        <p class="mb-8 text-sm font-medium leading-relaxed text-ink">
          Êtes-vous sûr de vouloir nous quitter ? <br/><br/>
          Cette action supprimera définitivement votre compte et son contenu.
        </p>
        <div class="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            class="flex-1 border-2 border-ink bg-surface px-6 py-4 text-[10px] font-black uppercase tracking-widest text-ink transition-all hover:bg-ink hover:text-canvas"
            @click="showDeleteConfirm = false"
          >
            Annuler
          </button>
          <button
            type="button"
            class="flex-1 border-2 border-rose-600 bg-rose-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-rose-700 hover:border-rose-700"
            @click="executeDelete"
          >
            Oui, supprimer
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
