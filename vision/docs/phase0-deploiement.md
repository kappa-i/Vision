# Phase 0 — Déploiement (sécurité)

Le code de l'app est prêt, mais la Phase 0 ne sera **effective** qu'après ces
étapes manuelles, dans cet ordre. Compter ~30 minutes.

> ⚠️ Tant que ce n'est pas fait, l'app ne peut plus uploader vers R2
> (elle n'a plus les clés — c'est voulu).

---

## 1. Cloudflare — RÉVOQUER les anciennes clés R2 (priorité absolue)

Les anciennes clés étaient embarquées dans le DMG/EXE déjà distribués :
elles sont considérées **compromises**.

1. Dashboard Cloudflare → **R2 → Manage R2 API Tokens**.
2. **Supprimer** le token actuel (celui dont les clés étaient dans `.env.local`).
3. **Créer un nouveau token** (Object Read & Write sur le bucket) et noter :
   Access Key ID + Secret Access Key.

## 2. Cloudflare — CORS sur le bucket

L'app upload désormais directement vers R2 (URL présignée) depuis la webview,
il faut autoriser le PUT cross-origin. Bucket → **Settings → CORS policy** :

```json
[
  {
    "AllowedOrigins": ["http://localhost:1420", "tauri://localhost", "http://tauri.localhost"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3. Supabase — exécuter le SQL

Dashboard Supabase → **SQL Editor** → coller le contenu de
[`supabase/phase0.sql`](../supabase/phase0.sql) → **Run**.

Ce script est rejouable sans danger. Il :
- active RLS sur toutes les tables avec des policies owner/membre ;
- ajoute `invites.expires_at` (72 h) ;
- crée les RPC `redeem_invite`, `set_project_status`,
  `set_media_approval`, `set_media_starred`.

## 4. Supabase — déployer l'Edge Function `r2-sign`

Dashboard → **Edge Functions → Deploy a new function** (éditeur dans le
navigateur) → nom : `r2-sign` → coller le contenu de
[`supabase/functions/r2-sign/index.ts`](../supabase/functions/r2-sign/index.ts)
→ Deploy.

Puis **Edge Functions → r2-sign → Secrets**, ajouter :

| Secret | Valeur |
|---|---|
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY` | la **nouvelle** Access Key (étape 1) |
| `R2_SECRET_KEY` | la **nouvelle** Secret Key (étape 1) |
| `R2_BUCKET` | nom du bucket |
| `R2_PUBLIC_DOMAIN` | ex. `https://pub-xxx.r2.dev` (le même qu'avant) |

(`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement.)

*Alternative CLI :* `npx supabase login` puis
`npx supabase functions deploy r2-sign --project-ref ekuowxscshqpspgttglb`
depuis le dossier `vision/`.

## 5. Nettoyer les anciennes clés côté app

- **Local** : dans `vision/.env.local`, supprimer les 5 lignes `VITE_R2_*`
  (le frontend ne les lit plus).
- **GitHub** : repo → Settings → Secrets → Actions → mettre à jour `ENV_FILE`
  pour retirer les `VITE_R2_*` (ou supprimer le secret s'il ne contient que ça).

## 6. Vérifier

1. `npm run tauri dev` → se connecter en créatif → ajouter une photo à la
   galerie → elle doit s'afficher et son URL doit être `…/project_<id>/…`.
2. Compte client (autre fenêtre/machine) → rejoindre avec un code → le code
   doit fonctionner une seule fois et afficher l'expiration dans le panneau
   d'invitation côté créatif.
3. Côté client : approuver une photo → vérifier qu'elle apparaît approuvée
   côté créatif (RPC + realtime).
4. Couper le réseau → modifier un titre → un toast d'erreur doit apparaître
   (plus d'échec silencieux).

---

## Ce qui a changé dans le code (résumé)

| Fichier | Changement |
|---|---|
| `supabase/functions/r2-sign/index.ts` | **Nouveau** — presigned URLs + delete, auth + ownership |
| `supabase/phase0.sql` | **Nouveau** — RLS complet + RPC + expiration invites |
| `src/services/r2.js` | Réécrit — plus de clés ni d'AWS SDK, passe par `r2-sign` |
| `src/services/sync.js` | RPC `redeem_invite`/`set_project_status`/`set_media_*` ; suppression des accès directs invites/membres |
| `src/store/invites.js` | Expiration 72 h, rachat via RPC avec messages d'erreur précis |
| `src/store/projects.js` | Statut via RPC ; cover sous `project_<id>/covers` ; erreurs en toast |
| `src/store/media.js` | Approbation/favori via RPC ; thumbs sous `project_<id>/thumbs` ; erreurs en toast |
| `src/store/comments.js`, `validations.js` | Erreurs de sync en toast |
| `src/store/toast.js` | Helper `syncError()` |
| `src/components/InvitePanel.vue` | Affichage expiration / code expiré |
| `src/pages/DashboardPage.vue` | Messages d'erreur précis au rachat de code + refresh |
| `src-tauri/tauri.conf.json` | CSP stricte (plus de `csp: null`) |
| `package.json` | `@aws-sdk/*` supprimés (−45 packages) |
