import { reactive, readonly } from "vue";
import { supabase } from "./supabase";

/**
 * Couche d'authentification — Supabase Auth (email + password).
 * Remplace l'ancienne version localStorage.
 * 
 * Le rôle (créatif / client) est désormais une conséquence de l'identité :
 *  - propriétaire du projet  → créatif
 *  - membre invité du projet → client
 * 
 * store/session.js dérive les permissions à partir de cette identité.
 */
const state = reactive({
  user: null,      // supabase User | null
  profile: null,   // { id, name } | null
  loading: true,   // true tant que la session n'est pas résolue
});

export const auth = readonly(state);

/** Initialise la session au démarrage (appelé dans main.js). */
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    state.user = session.user;
    await _loadProfile(session.user.id);
  }
  state.loading = false;

  // Écoute les changements d'état auth (login, logout, token refresh)
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user ?? null;
    if (state.user) {
      await _loadProfile(state.user.id);
    } else {
      state.profile = null;
    }
  });
}

async function _loadProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", userId)
    .maybeSingle();

  let profile = data;

  // Si le profil n'existe pas (bloqué par RLS à l'inscription) ou n'a pas de nom, 
  // on utilise les metadata pour le créer/mettre à jour maintenant qu'on est connecté.
  if ((!profile || !profile.name) && state.user?.user_metadata?.name) {
    const metaName = state.user.user_metadata.name;
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, name: metaName })
      .select()
      .maybeSingle();

    if (!error && updatedProfile) {
      profile = updatedProfile;
    } else {
      profile = { id: userId, name: metaName }; // Fallback optimiste
    }
  }

  state.profile = profile || null;
}

export function isOnboarded() {
  return !!state.profile?.name?.trim();
}

/** Inscription + connexion email / password. */
export async function signUp({ email, password, name }) {
  const { data, error } = await supabase.auth.signUp({ 
    email, 
    password,
    options: {
      data: { name: name.trim() } // Sauvegarde dans les metadata de Supabase Auth
    }
  });
  if (error) throw error;
  
  // Tente d'enregistrer le nom dans le profil (peut échouer si RLS bloque avant la validation d'email)
  // _loadProfile s'occupera du rattrapage grâce aux metadata
  if (data.user && name) {
    await supabase
      .from("profiles")
      .upsert({ id: data.user.id, name: name.trim() });
    state.profile = { id: data.user.id, name: name.trim() };
  }
  return data;
}

/** Connexion email / password. */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/** Mise à jour du nom de profil. */
export async function updateProfile({ name }) {
  if (!state.user) return;
  await supabase
    .from("profiles")
    .upsert({ id: state.user.id, name: name.trim() });
  if (state.profile) state.profile.name = name.trim();
  else state.profile = { id: state.user.id, name: name.trim() };
}

/** Déconnexion. */
export async function signOut() {
  await supabase.auth.signOut();
  state.user = null;
  state.profile = null;
}

/** 
 * Suppression du compte (Profile + RPC si existant).
 * Note: La suppression complète d'un utilisateur Supabase nécessite souvent un RPC (delete_user) côté serveur
 * ou de passer par l'admin API. On supprime au moins le profil ici.
 */
export async function deleteAccount() {
  if (!state.user) return;
  
  try {
    await supabase.from("profiles").delete().eq("id", state.user.id);
  } catch (e) {
    console.warn("Erreur suppression profil:", e);
  }

  try {
    // Si vous configurez une fonction Edge ou RPC "delete_user" sur Supabase
    await supabase.rpc("delete_user");
  } catch (e) {
    // On ignore si l'RPC n'est pas configuré
  }

  await signOut();
}
