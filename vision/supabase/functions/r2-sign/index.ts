// Edge Function "r2-sign" — accès sécurisé au bucket R2.
//
// Les clés R2 ne vivent QUE dans les secrets de cette fonction (jamais dans
// l'app distribuée). L'app authentifiée demande :
//   { action: "upload-url",   folder, filename, contentType } → URL PUT présignée (15 min)
//   { action: "delete",        url }                          → suppression d'un objet
//   { action: "delete-folder", prefix }                       → suppression d'un préfixe
//
// Règles d'autorisation :
//   - JWT Supabase valide obligatoire.
//   - Tous les objets vivent sous `project_<id>/…` ; l'upload et la
//     suppression sont réservés au PROPRIÉTAIRE du projet (le créatif).
//
// Secrets à configurer (supabase secrets / dashboard > Edge Functions) :
//   R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_DOMAIN

import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") ?? "";
const R2_BUCKET = Deno.env.get("R2_BUCKET") ?? "";
const R2_PUBLIC_DOMAIN = (Deno.env.get("R2_PUBLIC_DOMAIN") ?? "").replace(/\/$/, "");

const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY") ?? "",
  secretAccessKey: Deno.env.get("R2_SECRET_KEY") ?? "",
  service: "s3",
  region: "auto",
});

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FOLDER_RE = /^project_([A-Za-z0-9-]+)(\/(thumbs|covers))?$/;
const PREFIX_RE = /^project_([A-Za-z0-9-]+)\/$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function objectUrl(key: string) {
  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
}

function publicUrl(key: string) {
  return R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : objectUrl(key);
}

/** Retrouve la clé R2 à partir d'une URL (publique ou endpoint). */
function urlToKey(url: string): string | null {
  try {
    if (R2_PUBLIC_DOMAIN && url.startsWith(`${R2_PUBLIC_DOMAIN}/`)) {
      return url.slice(R2_PUBLIC_DOMAIN.length + 1);
    }
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "");
    return path.startsWith(`${R2_BUCKET}/`) ? path.slice(R2_BUCKET.length + 1) : path;
  } catch {
    return null;
  }
}

/** L'utilisateur est-il propriétaire du projet ? */
async function isOwner(projectId: string, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("projects")
    .select("owner_id")
    .filter("id", "eq", projectId)
    .maybeSingle();
  return !!data && String(data.owner_id) === String(userId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode invalide" }, 405);

  // --- Authentification ---
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user } = { user: null } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Non authentifié" }, 401);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }

  try {
    // --- URL d'upload présignée ---
    if (body.action === "upload-url") {
      const m = FOLDER_RE.exec(body.folder ?? "");
      if (!m) return json({ error: "Dossier invalide (attendu : project_<id>[/thumbs|/covers])" }, 400);
      if (!(await isOwner(m[1], user.id))) return json({ error: "Accès refusé" }, 403);

      const safeName = (body.filename ?? "file").replace(/[^a-zA-Z0-9.-]/g, "_");
      const key = `${body.folder}/${Date.now()}-${safeName}`;

      const target = new URL(objectUrl(key));
      target.searchParams.set("X-Amz-Expires", "900");
      const signed = await r2.sign(new Request(target, { method: "PUT" }), {
        aws: { signQuery: true },
      });

      return json({ uploadUrl: signed.url, publicUrl: publicUrl(key), key });
    }

    // --- Suppression d'un objet ---
    if (body.action === "delete") {
      const key = urlToKey(body.url ?? "");
      if (!key) return json({ error: "URL invalide" }, 400);
      const m = /^project_([A-Za-z0-9-]+)\//.exec(key);
      // Objets project_… : réservé au propriétaire. Anciens objets (covers/,
      // thumbs/ historiques) : utilisateur authentifié suffisant.
      if (m && !(await isOwner(m[1], user.id))) return json({ error: "Accès refusé" }, 403);

      const res = await r2.fetch(objectUrl(key), { method: "DELETE" });
      return json({ ok: res.ok });
    }

    // --- Suppression d'un dossier (préfixe) ---
    if (body.action === "delete-folder") {
      const m = PREFIX_RE.exec(body.prefix ?? "");
      if (!m) return json({ error: "Préfixe invalide (attendu : project_<id>/)" }, 400);
      if (!(await isOwner(m[1], user.id))) return json({ error: "Accès refusé" }, 403);

      const listUrl = new URL(`${R2_ENDPOINT}/${R2_BUCKET}`);
      listUrl.searchParams.set("list-type", "2");
      listUrl.searchParams.set("prefix", body.prefix);
      const listRes = await r2.fetch(listUrl.toString());
      const xml = await listRes.text();
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((k) => k[1]);

      for (const key of keys) {
        await r2.fetch(objectUrl(key), { method: "DELETE" });
      }
      return json({ ok: true, deleted: keys.length });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("r2-sign error:", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
