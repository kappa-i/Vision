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

// --- Étapes ---

export async function syncFetchStages(projectId) {
  const { data, error } = await supabase
    .from("stages")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function syncCreateStage(fields) {
  const { data, error } = await supabase
    .from("stages")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function syncUpdateStage(id, fields) {
  const { error } = await supabase.from("stages").update(fields).eq("id", id);
  if (error) throw error;
}

export async function syncDeleteStage(id) {
  const { error } = await supabase.from("stages").delete().eq("id", id);
  if (error) throw error;
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

export async function syncFindInviteByCode(code) {
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function syncAcceptInvite(id) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invites")
    .update({ accepted_at: now })
    .eq("id", id);
  if (error) throw error;
  return now;
}

export async function syncDeleteInvite(id) {
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) throw error;
}

// --- Membres projet (join via code) ---

export async function syncAddProjectMember(projectId, userId) {
  // upsert : tolère les doublons
  const { error } = await supabase
    .from("project_members")
    .upsert({ project_id: projectId, user_id: userId });
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
      { event: "*", schema: "public", table: "stages", filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onStage?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "media", filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onMedia?.(payload)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
