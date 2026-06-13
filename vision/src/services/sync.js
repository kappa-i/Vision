import { supabase } from "./supabase";

/**
 * Couche de synchronisation — Supabase (cloud).
 * 
 * Stratégie offline-first :
 *   - SQLite local = cache de lecture rapide / fonctionnement hors-ligne
 *   - Supabase     = source de vérité cloud (lecture + écriture + Realtime)
 * 
 * Chaque mutation locale (create/update/delete) appelle aussi Supabase.
 * Au chargement, on tire les données depuis Supabase pour être à jour.
 * Le Realtime pousse les changements d'autres machines en temps réel.
 */

// --- Projets ---

export async function syncFetchProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, description, cover_path, created_at, owner_id")
    .order("created_at", { ascending: false });
  if (error) throw error;
  console.log("SYNC FETCHED PROJECTS:", data);
  return data ?? [];
}

export async function syncCreateProject(name, description, ownerId) {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, owner_id: ownerId, status: "draft" })
    .select()
    .single();
  if (error) {
    // Log complet pour diagnostic
    console.error("syncCreateProject error:", JSON.stringify(error));
    throw error;
  }
  return data;
}

export async function syncUpdateProject(id, fields) {
  const { error } = await supabase.from("projects").update(fields).eq("id", id);
  if (error) throw error;
}

export async function syncDeleteProject(id) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// --- Médias ---

export async function syncFetchMedia(projectId, kind) {
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("project_id", projectId)
    .eq("kind", kind)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function syncCreateMedia(fields) {
  const { data, error } = await supabase
    .from("media")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function syncUpdateMedia(id, fields) {
  const { error } = await supabase.from("media").update(fields).eq("id", id);
  if (error) throw error;
}

export async function syncDeleteMedia(id) {
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw error;
}

// --- Commentaires ---

export async function syncFetchComments(projectId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("project_id", projectId)
    .is("media_id", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function syncFetchImageComments(mediaId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function syncCreateComment(fields) {
  const { data, error } = await supabase
    .from("comments")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function syncUpdateComment(id, fields) {
  const { error } = await supabase.from("comments").update(fields).eq("id", id);
  if (error) throw error;
}

export async function syncDeleteComment(id) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

// --- Validations ---

export async function syncFetchValidations(projectId) {
  const { data, error } = await supabase
    .from("validations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function syncCreateValidation(projectId, decision) {
  const { data, error } = await supabase
    .from("validations")
    .insert({ project_id: projectId, decision })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// --- Invitations ---

export async function syncFetchInvites(projectId) {
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function syncCreateInvite(fields) {
  const { data, error } = await supabase
    .from("invites")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function syncDeleteInvite(id) {
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) throw error;
}

// --- Membres projet ---

/** Quitter un projet (le client supprime sa propre ligne de membre). */
export async function syncLeaveProject(projectId, userId) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}

// --- RPC sécurisées (SECURITY DEFINER côté Supabase, cf. supabase/phase0.sql) ---

/**
 * Rachat d'un code d'invitation. La table invites n'est pas lisible par les
 * clients : la RPC valide (existence, expiration, usage unique) et inscrit
 * le membre. Renvoie { ok, project_id?, error? }.
 */
export async function syncRedeemInvite(code) {
  const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) throw error;
  return data;
}

/** Changement de statut projet — autorisé owner + membres, statuts whitelistés. */
export async function syncSetProjectStatus(id, status) {
  const { error } = await supabase.rpc("set_project_status", {
    p_project_id: String(id),
    p_status: status,
  });
  if (error) throw error;
}

/** Approbation d'une photo par le client (ne touche que la colonne approval). */
export async function syncSetMediaApproval(id, approval) {
  const { error } = await supabase.rpc("set_media_approval", {
    p_media_id: String(id),
    p_approval: approval,
  });
  if (error) throw error;
}

/** Favori ♥ d'une photo (ne touche que la colonne starred). */
export async function syncSetMediaStarred(id, starred) {
  const { error } = await supabase.rpc("set_media_starred", {
    p_media_id: String(id),
    p_starred: !!starred,
  });
  if (error) throw error;
}

// --- Realtime helpers ---

/**
 * Souscrit aux changements d'une table pour un projet donné.
 * Renvoie la fonction d'unsubscribe.
 */
export function subscribeToProject(projectId, callbacks) {
  const channel = supabase
    .channel(`project:${projectId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
      (payload) => callbacks.onProject?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "comments", filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onComment?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "validations", filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onValidation?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "media", filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onMedia?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
