# Vision — TODO

Roadmap issue de l'audit du 2026-06-12. Voir aussi la réflexion produit :
[`docs/fonctionnement.md`](docs/fonctionnement.md).

> ⚠️ Hors périmètre (décision produit) : paiement intégré / quotas de sélection
> payants. Vision est un outil de **collaboration**, pas de monétisation.
> Pas d'app mobile non plus — le « client en mobilité » sera couvert par le
> client web responsive.

---

## 🔴 Phase 0 — Sécurité (avant toute distribution)

> ✅ Déployée et testée de bout en bout le 2026-06-12 (upload, RLS, RPC,
> invitations, livraison, realtime). Voir `docs/phase0-deploiement.md`.

- [x] Sortir les clés R2 du bundle → Edge Function `r2-sign` + presigned URLs
- [x] Policies RLS table par table (owner OU membre) — `supabase/phase0.sql`
- [x] Échecs d'écriture cloud remontés en toast (`syncError`)
- [x] Codes d'invitation : expiration 72 h, usage unique, RPC `redeem_invite`
      (table invites non lisible par les clients)
- [x] CSP définie dans `tauri.conf.json`
- [x] Déploiement (SQL v2, Edge Function + secrets, CORS bucket, ENV_FILE supprimé)
- [x] Ancien token R2 révoqué chez Cloudflare + `VITE_R2_*` retirés de `.env.local`

## 🟠 Phase 1 — Réparer le cœur

- [x] **Livraison côté client** : `downloadFile`/`downloadAll` téléchargent
      les URLs R2 via fetch + `writeFile` (fait en avance le 2026-06-12)
- [x] Orphelins R2 purgés à la suppression (effet du passage à `project_<id>/`)
- [x] Suppression de compte (OK confirmé le 2026-06-13)
- [x] ~~Rôle par projet sur le dashboard~~ — non pertinent : le rôle est par
      projet (résolu à l'ouverture + boutons supprimer/quitter des cartes) ;
      « Nouveau projet » doit rester visible pour tous (chacun peut créer ses
      propres projets)
- [x] Realtime : DELETE (média + commentaire) et UPDATE commentaire gérés ;
      `REPLICA IDENTITY FULL` sur media/comments (cf. phase0.sql) — 2026-06-13
- [ ] Nettoyage code mort : données seed/picsum, store `stages` (Timeline retirée)

## 🟡 Phase 2 — Protection média (la vraie, remplace l'anti-screenshot seul)

- [ ] À l'upload : aperçu basse-déf **filigrané** (étendre `generate_thumb`
      en Rust), affiché partout avant la remise
- [ ] Originaux dans un bucket R2 **privé** ; accès uniquement par URL signée,
      débloquée à la remise (« release ») — remplace le domaine public actuel

## 🔵 Phase 3 — Client web (zéro installation)

- [ ] Déployer le front Vue sur le web pour les clients (le code est déjà
      gardé par `isTauri()` presque partout) — supprime les problèmes
      DMG/Gatekeeper et couvre la consultation sur téléphone (responsive)
- [ ] Invitation par **lien email** au lieu d'un code (meilleure UX + sécurité)

## 🟣 Phase 4 — Rétention & confort

- [ ] Notifications email (« Marie a ajouté 24 photos à valider ») —
      Resend + triggers Supabase ; le client ne vit pas dans l'app
- [ ] Versionnage des retouches (v1/v2/v3 + historique, extension de
      l'avant/après existant)
- [ ] Branding du créatif sur l'espace client (logo, couleurs)
- [ ] Plusieurs clients par projet (couple, équipe marketing)
- [ ] Téléchargement par format (web 2048px / impression pleine résolution)
- [ ] Export sélection vers Lightroom (liste des fichiers approuvés)

## ⚪ Fond de panier — UX & finition

- [ ] Sélection multiple par cases à cocher (suppression groupée) — *partiel : bulk « Tout approuver » fait*
- [ ] Undo (annuler une suppression)
- [ ] Multi-langue (i18n)
- [ ] Performance sur gros volumes (centaines de photos)
- [ ] Modèle économique (abonnement créatif, client gratuit) — sans paiement
      in-app ni quotas

---

## ✅ Déjà fait

- [x] Scaffold Tauri 2 + Vue 3 + Vite + Tailwind v4 + SQLite
- [x] Dashboard, création / suppression de projet, statuts
- [x] À propos = tableau de bord projet (phase + prochaine action + chiffres)
- [x] Moodboard & Galerie (upload dialog + drag & drop)
- [x] Comparaison avant / après (curseur)
- [x] Annotations épinglées + commentaires par photo
- [x] Validation par photo → décision globale + livraison alignées
- [x] Feedback centralisé
- [x] Livraison (verrouillée jusqu'à remise par le créatif)
- [x] Vraie identité / auth (Supabase Auth, plus de sélecteur de rôle)
- [x] Synchronisation cloud (Supabase + Realtime)
- [x] Stockage médias cloud (Cloudflare R2) — *à sécuriser, cf. Phase 0*
- [x] Invitation client par code
- [x] Non-lus (pastilles locales, par rôle)
- [x] Protections desktop (clic droit off, capture d'écran noire)
- [x] Onboarding 1er lancement (visite guidée)
- [x] Validation en masse, tri & recherche, favoris ♥, annotations résolues,
      confirmations, toasts, lazy-load, écran vide guidé
- [x] Distribution : releases GitHub Actions (Windows + macOS universel)
