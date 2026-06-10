<script setup>
import { ref, reactive, nextTick, onMounted } from "vue";
import { gsap } from "gsap";
import { signIn, signUp } from "../services/auth";
import { useRouter } from "vue-router";
import { theme } from "../composables/useTheme";
import LogoBigBlack from "../assets/LogoBig.png";
import LogoBigWhite from "../assets/LogoBigWhite.png";

const router = useRouter();
const mode = ref("login");
const form = reactive({ name: "", email: "", password: "" });
const error = ref("");
const loading = ref(false);
const signupSuccess = ref(false);

const wrapRef = ref(null);
const leftRef = ref(null);
const rightRef = ref(null);
const tabIndicatorRef = ref(null);
const tabLoginRef = ref(null);
const tabSignupRef = ref(null);

onMounted(() => {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  tl.fromTo(wrapRef.value, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.55 });
  if (leftRef.value) {
    tl.fromTo(leftRef.value, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.4 }, "<0.1");
  }
  tl.fromTo(rightRef.value, { autoAlpha: 0, x: 20 }, { autoAlpha: 1, x: 0, duration: 0.4 }, "<");
  moveIndicator(true);
});

function moveIndicator(instant) {
  const target = mode.value === "login" ? tabLoginRef.value : tabSignupRef.value;
  if (!target || !tabIndicatorRef.value) return;
  const navRect = target.parentElement.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  if (instant) {
    gsap.set(tabIndicatorRef.value, { x: rect.left - navRect.left, width: rect.width });
  } else {
    gsap.to(tabIndicatorRef.value, { x: rect.left - navRect.left, width: rect.width, duration: 0.28, ease: "power2.inOut" });
  }
}

function switchMode(newMode) {
  if (newMode === mode.value) return;
  mode.value = newMode;
  error.value = "";
  nextTick(() => moveIndicator(false));
}

function onNameEnter(el, done) {
  gsap.fromTo(el,
    { autoAlpha: 0, height: 0 },
    { autoAlpha: 1, height: "auto", duration: 0.3, ease: "power3.out", clearProps: "height", onComplete: done }
  );
}
function onNameLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, height: 0, duration: 0.18, ease: "power2.in", onComplete: done });
}

function onErrorEnter(el, done) {
  gsap.fromTo(el, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power3.out", onComplete: done });
}
function onErrorLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, y: -6, duration: 0.15, ease: "power2.in", onComplete: done });
}

function onPanelLeave(el, done) {
  gsap.to(el, { autoAlpha: 0, y: -14, duration: 0.2, ease: "power2.in", onComplete: done });
}
function onPanelEnter(el, done) {
  gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.36, ease: "power3.out", onComplete: done });
}

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    if (mode.value === "signup") {
      if (!form.name.trim()) { error.value = "Renseignez votre nom."; return; }
      const data = await signUp({ email: form.email, password: form.password, name: form.name });
      if (data.session) {
        router.replace({ name: "dashboard" });
      } else {
        signupSuccess.value = true;
      }
    } else {
      await signIn({ email: form.email, password: form.password });
      router.replace({ name: "dashboard" });
    }
  } catch (e) {
    error.value = e.message || "Une erreur est survenue.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4 lg:p-12">
    <div ref="wrapRef" class="flex w-full max-w-5xl flex-col lg:flex-row border-4 border-ink bg-surface shadow-sm">

      <!-- Colonne Gauche : Identité Visuelle -->
      <div ref="leftRef" class="hidden lg:flex lg:w-1/3 flex-col justify-between bg-ink p-12 text-canvas">
        <div>
          <img :src="theme === 'dark' ? LogoBigBlack : LogoBigWhite" alt="VISION" class="h-16 w-auto mb-4" />
          <p class="mt-4 text-lg font-bold uppercase tracking-widest text-canvas/50 leading-relaxed">
            Collaboration<br/>Créatif ↔ Client
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-canvas/30">
            © {{ new Date().getFullYear() }} — Plateforme d'échange de médias
          </p>
        </div>
      </div>

      <!-- Colonne Droite : Formulaire -->
      <div ref="rightRef" class="w-full lg:w-2/3 flex items-center justify-center p-8 sm:p-12 lg:p-16 bg-canvas">
        <div class="w-full max-w-md">

          <!-- Mobile Header -->
          <div class="mb-12 lg:hidden flex flex-col items-center text-center">
            <img :src="theme === 'dark' ? LogoBigWhite : LogoBigBlack" alt="VISION" class="h-12 w-auto mb-2" />
            <p class="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">Collaboration créatif — client</p>
          </div>

          <!-- Transition formulaire ↔ succès -->
          <Transition :css="false" mode="out-in" @leave="onPanelLeave" @enter="onPanelEnter">

            <!-- Message de succès -->
            <div v-if="signupSuccess" key="success" class="border-4 border-emerald-500 bg-emerald-50 p-8">
              <h2 class="text-2xl font-black uppercase tracking-tighter text-emerald-700">Vérifiez vos emails !</h2>
              <p class="mt-4 text-sm font-medium leading-relaxed text-emerald-900">
                Votre compte a bien été créé. Nous vous avons envoyé un lien de confirmation à l'adresse <strong>{{ form.email }}</strong>.
              </p>
              <p class="mt-2 text-sm font-medium leading-relaxed text-emerald-900">
                Veuillez cliquer sur ce lien pour activer votre compte avant de pouvoir vous connecter.
              </p>
              <button
                type="button"
                class="mt-8 w-full border-2 border-emerald-700 bg-emerald-600 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition hover:-translate-y-0.5 hover:shadow-md"
                @click="mode = 'login'; signupSuccess = false; form.password = ''"
              >
                Retour à la connexion
              </button>
            </div>

            <!-- Formulaire classique -->
            <div v-else key="form">

              <!-- Onglets avec indicateur glissant -->
              <div class="relative mb-8 flex border-b-4 border-line">
                <button
                  ref="tabLoginRef"
                  type="button"
                  class="flex-1 pb-4 text-xs font-black uppercase tracking-widest transition-colors duration-200"
                  :class="mode === 'login' ? 'text-ink' : 'text-muted hover:text-ink'"
                  @click="switchMode('login')"
                >
                  Connexion
                </button>
                <button
                  ref="tabSignupRef"
                  type="button"
                  class="flex-1 pb-4 text-xs font-black uppercase tracking-widest transition-colors duration-200"
                  :class="mode === 'signup' ? 'text-ink' : 'text-muted hover:text-ink'"
                  @click="switchMode('signup')"
                >
                  Inscription
                </button>
                <span
                  ref="tabIndicatorRef"
                  class="pointer-events-none absolute bottom-[-4px] left-0 h-1 bg-ink"
                  style="width: 0"
                />
              </div>

              <form class="space-y-6" @submit.prevent="submit">

                <!-- Nom (inscription) — animé en hauteur -->
                <Transition :css="false" @enter="onNameEnter" @leave="onNameLeave">
                  <div v-if="mode === 'signup'" style="overflow: hidden">
                    <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-ink">Nom complet</label>
                    <input
                      v-model="form.name"
                      type="text"
                      placeholder="Ex: John Doe"
                      autocomplete="name"
                      class="w-full border-2 border-ink bg-canvas px-4 py-3 text-lg font-bold text-ink outline-none placeholder:text-muted/30 focus:shadow-sm transition-shadow"
                    />
                  </div>
                </Transition>

                <!-- Email -->
                <div>
                  <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-ink">Email</label>
                  <input
                    v-model="form.email"
                    type="email"
                    placeholder="vous@exemple.com"
                    autocomplete="email"
                    required
                    class="w-full border-2 border-ink bg-canvas px-4 py-3 text-lg font-bold text-ink outline-none placeholder:text-muted/30 focus:shadow-sm transition-shadow"
                  />
                </div>

                <!-- Mot de passe -->
                <div>
                  <label class="mb-2 block text-[10px] font-black uppercase tracking-widest text-ink">Mot de passe</label>
                  <input
                    v-model="form.password"
                    type="password"
                    placeholder="••••••••"
                    autocomplete="current-password"
                    required
                    minlength="6"
                    class="w-full border-2 border-ink bg-canvas px-4 py-3 text-xl font-black tracking-tight text-ink outline-none placeholder:text-muted/30 focus:shadow-sm transition-shadow"
                  />
                </div>

                <!-- Erreur -->
                <Transition :css="false" @enter="onErrorEnter" @leave="onErrorLeave">
                  <div v-if="error" class="border-2 border-rose-500 bg-rose-50 p-4">
                    <p class="text-[10px] font-black uppercase tracking-widest text-rose-600">
                      Erreur : {{ error }}
                    </p>
                  </div>
                </Transition>

                <!-- Submit -->
                <button
                  type="submit"
                  :disabled="loading"
                  class="mt-8 w-full border-2 border-ink bg-accent px-6 py-4 text-xs font-black uppercase tracking-widest text-canvas transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {{ loading ? "CHARGEMENT…" : (mode === "login" ? "Se connecter" : "Créer le compte") }}
                </button>
              </form>
            </div>

          </Transition>

        </div>
      </div>

    </div>
  </div>
</template>
