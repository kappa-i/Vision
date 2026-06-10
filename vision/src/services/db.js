import Database from "@tauri-apps/plugin-sql";

/**
 * Accès au cache local SQLite (cahier des charges §5).
 * Le schéma est créé côté Rust via les migrations du plugin
 * (voir src-tauri/src/lib.rs).
 *
 * Note : ne fonctionne que dans le runtime Tauri. En dev navigateur
 * pur (`npm run dev` sans Tauri), `isTauri()` renvoie false et les
 * appels DB sont court-circuités.
 */
let _db = null;

export function isTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getDb() {
  if (!isTauri()) return null;
  if (!_db) {
    _db = await Database.load("sqlite:vision.db");
  }
  return _db;
}

// --- Requêtes projets (MVP) ---

export async function listProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, name, status, description, cover_path, created_at \
     FROM projects ORDER BY created_at DESC"
  );
}

export async function latestActivityAt(projectId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select(
    "SELECT MAX(t) AS latest FROM ( \
       SELECT created_at AS t FROM comments WHERE project_id = $1 \
       UNION ALL SELECT created_at FROM media WHERE project_id = $1 \
       UNION ALL SELECT created_at FROM validations WHERE project_id = $1 \
     )",
    [projectId]
  );
  return rows[0]?.latest || null;
}

export async function updateProjectMeta(id, name, description) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    "UPDATE projects SET name = $1, description = $2 WHERE id = $3",
    [name, description, id]
  );
}

export async function createProject(name, description) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO projects (name, description, status) VALUES ($1, $2, $3)",
    [name, description, "draft"]
  );
  return res.lastInsertId;
}

export async function setProjectCover(id, path) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE projects SET cover_path = $1 WHERE id = $2", [
    path,
    id,
  ]);
}

export async function setProjectStatus(id, status) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE projects SET status = $1 WHERE id = $2", [
    status,
    id,
  ]);
}

export async function deleteProject(id) {
  const db = await getDb();
  if (!db) return;
  // Suppression explicite des données liées (FK cascade non garanti selon PRAGMA)
  for (const t of ["comments", "media", "validations", "stages", "invites"]) {
    await db.execute(`DELETE FROM ${t} WHERE project_id = $1`, [id]);
  }
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}

// --- Requêtes commentaires / feedback (MVP §7.2e) ---

export async function listComments(projectId) {
  const db = await getDb();
  if (!db) return [];
  // Feedback général = commentaires non rattachés à une image
  return db.select(
    "SELECT id, project_id, media_id, author, body, x, y, created_at \
     FROM comments WHERE project_id = $1 AND media_id IS NULL ORDER BY created_at ASC",
    [projectId]
  );
}

export async function deleteComment(id) {
  const db = await getDb();
  if (!db) return;
  await db.execute("DELETE FROM comments WHERE id = $1", [id]);
}

export async function listImageComments(mediaId) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, project_id, media_id, author, body, x, y, resolved, created_at \
     FROM comments WHERE media_id = $1 ORDER BY created_at ASC",
    [mediaId]
  );
}

export async function setCommentResolved(id, resolved) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE comments SET resolved = $1 WHERE id = $2", [
    resolved ? 1 : 0,
    id,
  ]);
}

export async function addComment({
  projectId,
  author,
  body,
  mediaId = null,
  x = null,
  y = null,
}) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO comments (project_id, media_id, author, body, x, y) \
     VALUES ($1, $2, $3, $4, $5, $6)",
    [projectId, mediaId, author, body, x, y]
  );
  return res.lastInsertId;
}

// --- Médias : Moodboard & Galerie (MVP §7.2a/b) ---

export async function listMedia(projectId, kind) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, project_id, kind, path, before_path, thumb_path, title, starred, approval, album, in_delivery, position, created_at \
     FROM media WHERE project_id = $1 AND kind = $2 ORDER BY position ASC, created_at ASC",
    [projectId, kind]
  );
}

export async function setMediaThumb(id, thumbPath) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET thumb_path = $1 WHERE id = $2", [thumbPath, id]);
}

export async function setMediaTitle(id, title) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET title = $1 WHERE id = $2", [title, id]);
}

export async function listUnresolvedAnnotationsByProject(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT c.media_id, m.title, m.thumb_path, COUNT(*) as count \
     FROM comments c JOIN media m ON m.id = c.media_id \
     WHERE m.project_id = $1 AND c.resolved = 0 AND c.media_id IS NOT NULL \
     GROUP BY c.media_id ORDER BY count DESC",
    [projectId]
  );
}

export async function addMedia({ projectId, kind, path, title = null, album = null }) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO media (project_id, kind, path, title, album) VALUES ($1, $2, $3, $4, $5)",
    [projectId, kind, path, title, album]
  );
  return res.lastInsertId;
}

export async function setMediaBefore(id, beforePath) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET before_path = $1 WHERE id = $2", [
    beforePath,
    id,
  ]);
}

export async function setMediaFavorite(id, fav) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET starred = $1 WHERE id = $2", [
    fav ? 1 : 0,
    id,
  ]);
}

export async function setMediaApproval(id, approval) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET approval = $1 WHERE id = $2", [
    approval,
    id,
  ]);
}

export async function setMediaAlbum(id, album) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET album = $1 WHERE id = $2", [album, id]);
}

export async function setMediaInDelivery(id, value) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE media SET in_delivery = $1 WHERE id = $2", [value ? 1 : 0, id]);
}

export async function deleteMedia(id) {
  const db = await getDb();
  if (!db) return;
  await db.execute("DELETE FROM media WHERE id = $1", [id]);
}

export async function updateMediaPositions(updates) {
  const db = await getDb();
  if (!db) return;
  for (const { id, position } of updates) {
    await db.execute("UPDATE media SET position = $1 WHERE id = $2", [position, id]);
  }
}

// --- Validations : décision + historique (MVP §7.2c) ---

export async function listValidations(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, project_id, decision, created_at \
     FROM validations WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId]
  );
}

export async function addValidation(projectId, decision) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO validations (project_id, decision) VALUES ($1, $2)",
    [projectId, decision]
  );
  return res.lastInsertId;
}

// --- Timeline : étapes du projet (MVP §7.2d) ---

export async function listStages(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, project_id, label, position, status, reached_at \
     FROM stages WHERE project_id = $1 ORDER BY position ASC",
    [projectId]
  );
}

export async function insertStage({ projectId, label, position, status }) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO stages (project_id, label, position, status) \
     VALUES ($1, $2, $3, $4)",
    [projectId, label, position, status]
  );
  return res.lastInsertId;
}

export async function updateStage(id, status, reachedAt) {
  const db = await getDb();
  if (!db) return;
  await db.execute(
    "UPDATE stages SET status = $1, reached_at = $2 WHERE id = $3",
    [status, reachedAt, id]
  );
}

export async function updateStageLabel(id, label) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE stages SET label = $1 WHERE id = $2", [label, id]);
}

export async function setStageDate(id, reachedAt) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE stages SET reached_at = $1 WHERE id = $2", [
    reachedAt,
    id,
  ]);
}

export async function deleteStage(id) {
  const db = await getDb();
  if (!db) return;
  await db.execute("DELETE FROM stages WHERE id = $1", [id]);
}

// --- Invitations client (MVP §10.1, §6) ---

export async function createInvite({ projectId, code, email = null }) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.execute(
    "INSERT INTO invites (project_id, code, email) VALUES ($1, $2, $3)",
    [projectId, code, email]
  );
  return res.lastInsertId;
}

export async function listInvites(projectId) {
  const db = await getDb();
  if (!db) return [];
  return db.select(
    "SELECT id, project_id, code, email, created_at, accepted_at \
     FROM invites WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId]
  );
}

export async function findInviteByCode(code) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select(
    "SELECT id, project_id, code, email, created_at, accepted_at \
     FROM invites WHERE code = $1 LIMIT 1",
    [code]
  );
  return rows[0] || null;
}

export async function acceptInvite(id, acceptedAt) {
  const db = await getDb();
  if (!db) return;
  await db.execute("UPDATE invites SET accepted_at = $1 WHERE id = $2", [
    acceptedAt,
    id,
  ]);
}

export async function deleteInvite(id) {
  const db = await getDb();
  if (!db) return;
  await db.execute("DELETE FROM invites WHERE id = $1", [id]);
}
