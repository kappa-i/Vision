<div align="center">

# Vision

**L'espace de collaboration entre un créatif et son client.**

Du moodboard à la livraison finale, au même endroit — pour que le client ait
enfin la même clarté sur le projet que le créatif a en tête.

Application desktop (Windows & macOS) · Tauri 2 · Vue 3 · Supabase · Cloudflare R2

</div>

---

## Sommaire

- [Le problème](#le-problème)
- [Ce que fait Vision](#ce-que-fait-vision)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Rôles & permissions](#rôles--permissions)
- [Sécurité](#sécurité)
- [Installation (utilisateur)](#installation-utilisateur)
- [Développement](#développement)
- [Structure du projet](#structure-du-projet)
- [Build & release](#build--release)
- [Feuille de route](#feuille-de-route)

---

## Le problème

Aujourd'hui, le feedback entre un créatif (photographe, graphiste, directeur
artistique) et son client se disperse entre mails, WhatsApp, WeTransfer et
appels. Résultat : allers-retours interminables, malentendus sur la direction
artistique, perte de temps, client peu impliqué.

**Vision n'est ni un outil de gestion de projet générique (Notion, Trello), ni
un simple transfert de fichiers (WeTransfer).** C'est un espace pensé pour la
**relation créatif ↔ client**, centré sur la vision et la validation.

## Ce que fait Vision

Le créatif crée un espace projet, y pose sa direction artistique, téléverse son
avancement, et invite son client avec un simple code. Le client consulte,
annote, valide ou demande des révisions — et récupère ses fichiers finaux une
fois le projet remis. Tout est synchronisé en temps réel entre les deux
machines.

## Fonctionnalités

### Côté créatif
- **Dashboard** — tous ses projets, leur statut (en cours / à revoir / validé /
  livré), recherche, couverture personnalisée.
- **Moodboard** — direction artistique : images de référence, organisées en
  dossiers, glisser-déposer.
- **Galerie** — téléversement des photos (dialogue natif ou drag & drop),
  organisation par albums, comparaison **avant / après** au curseur.
- **Livraison** — choix des fichiers approuvés à remettre, remise officielle au
  client (acte distinct de la validation).
- **Invitation** — génère un code à usage unique (expire après 72 h) pour
  donner accès au client.

### Côté client
- **Validation par photo** — approuve ou demande une révision sur chaque visuel ;
  la décision globale du projet en découle.
- **Annotations** — épingle un commentaire à un endroit précis d'une image,
  marque les retours comme résolus.
- **Feedback** — fil de discussion centralisé, rattaché au projet.
- **Téléchargement** — récupère les fichiers finaux une fois le projet remis
  (téléchargement individuel ou « tout télécharger »).

### Transversal
- **Synchronisation temps réel** entre les machines (Supabase Realtime).
- **Pastilles de nouveautés** par projet et par onglet.
- **Notifications visuelles** (toasts) pour chaque action et chaque erreur.
- **Visite guidée** au premier lancement.
- **Protection des visuels** (desktop) : clic droit désactivé, et exclusion des
  captures d'écran (fiable sur Windows ; partielle sur macOS, cf.
  [Sécurité](#sécurité)).

## Stack technique

| Couche | Techno |
|---|---|
| **Application desktop** | [Tauri 2](https://tauri.app) (binaire natif léger, Rust) |
| **Frontend** | [Vue 3](https://vuejs.org) (Composition API, JavaScript) + [Vite 6](https://vite.dev) |
| **Styles** | [Tailwind CSS v4](https://tailwindcss.com) |
| **Animations** | [GSAP](https://gsap.com) |
| **Cache local** | SQLite via `tauri-plugin-sql` |
| **Backend / Auth / Realtime** | [Supabase](https://supabase.com) (Postgres + Auth + Realtime) |
| **Stockage des médias** | [Cloudflare R2](https://developers.cloudflare.com/r2/) (via Edge Function + URLs présignées) |
| **CI / distribution** | GitHub Actions (`tauri-action`) |

## Architecture

Vision combine trois sources de données, chacune avec un rôle précis :

```
┌─────────────────────┐         ┌──────────────────────┐
│   App desktop        │        │      Supabase         │
│   (Tauri + Vue)      │◀──────▶│  Postgres + Auth +    │
│                      │ Realtime│  Realtime (RLS/RPC)  │
│  ┌────────────────┐  │        └──────────────────────┘
│  │ SQLite (cache) │  │                  ▲
│  └────────────────┘  │                  │ métadonnées
│          │ instantané│                  │ (chemins, statuts…)
│          ▼           │        ┌──────────────────────┐
│   Affichage local    │        │   Cloudflare R2       │
│                      │───────▶│  fichiers images      │
│         upload via    │ presign│  (bucket)            │
│      Edge Function    │  + PUT  └──────────────────────┘
└─────────────────────┘
```

- **Supabase Postgres** = source de vérité pour les métadonnées (projets,
  médias, commentaires, validations, invitations, membres).
- **SQLite local** = cache de lecture rapide / repli hors-ligne.
- **Cloudflare R2** = stockage des fichiers images. L'app n'a jamais les clés
  R2 : elle demande une **URL présignée** à une Edge Function Supabase, qui
  vérifie l'identité et la propriété du projet avant de la délivrer.
- Tous les objets R2 vivent sous `project_<id>/` (originaux),
  `project_<id>/thumbs/` (miniatures) et `project_<id>/covers/` (couvertures).

## Rôles & permissions

Le rôle découle de l'identité, il n'est pas choisi manuellement :

- **Créatif** = propriétaire du projet (`projects.owner_id`).
- **Client** = membre invité (`project_members`, via un code d'invitation).

| Action | Créatif | Client |
|---|:---:|:---:|
| Créer / supprimer un projet | ✅ | ❌ |
| Quitter un projet rejoint | — | ✅ |
| Inviter | ✅ | ❌ |
| Téléverser des médias / éditer le moodboard | ✅ | ❌ |
| Commenter / annoter | ✅ | ✅ |
| Approuver / demander une révision | ❌ | ✅ |
| Choisir & remettre la livraison | ✅ | ❌ |
| Télécharger les fichiers remis | ✅ | ✅ |

Ces règles ne sont pas seulement masquées dans l'UI : elles sont **imposées
côté serveur** par les politiques RLS de Supabase et des fonctions RPC dédiées
(voir ci-dessous).

## Sécurité

- **Aucune clé secrète dans l'app distribuée.** Les clés Cloudflare R2 vivent
  uniquement dans les secrets de l'Edge Function `r2-sign`. Les uploads passent
  par des URLs présignées délivrées après vérification de l'identité et de la
  propriété du projet.
- **Row Level Security (RLS)** sur toutes les tables (accès propriétaire ou
  membre), avec des fonctions `SECURITY DEFINER` pour éviter la récursion entre
  `projects` et `project_members`.
- **Écritures client contrôlées par RPC** (`redeem_invite`,
  `set_project_status`, `set_media_approval`, `set_media_starred`) : le client
  ne peut modifier que ce qui le concerne.
- **Codes d'invitation** : usage unique, expiration 72 h, validés côté serveur
  (la table n'est pas énumérable par les clients).
- **CSP stricte** dans `tauri.conf.json`.
- **Protection des visuels (desktop)** : exclusion des captures d'écran via
  `setContentProtected`. Fiable sur **Windows** (screenshot + enregistrement) ;
  sur **macOS**, le screenshot est bloqué mais pas l'enregistrement vidéo — une
  limite de l'OS, pas de l'app. La protection robuste et multiplateforme
  (aperçus basse-déf filigranés + originaux en accès signé) est prévue en
  feuille de route.

> Le détail de la configuration sécurité (rotation des clés, RLS, déploiement
> de l'Edge Function) est documenté dans
> [`vision/docs/phase0-deploiement.md`](vision/docs/phase0-deploiement.md).

## Installation (utilisateur)

Télécharger la dernière version depuis la page **Releases** du dépôt.

### Windows
Lancer le fichier `.exe` ou `.msi`.

### macOS
L'app n'est pas encore notarisée par Apple, donc macOS affichera *« vision est
endommagé »* au premier lancement. Ce n'est pas une vraie corruption, juste
Gatekeeper. Pour débloquer :

1. Télécharger le `.dmg` (`vision_x.x.x_universal.dmg`, fonctionne sur Mac Intel
   et Apple Silicon).
2. Ouvrir le DMG et glisser **vision** dans **Applications**.
3. Dans le **Terminal** :
   ```bash
   xattr -d com.apple.quarantine /Applications/vision.app
   ```
4. Lancer l'app.

## Développement

### Prérequis
- [Node.js](https://nodejs.org) 20+
- [Rust](https://www.rust-lang.org/tools/install) (stable) + la toolchain de
  build de la plateforme :
  - **Windows** : Visual Studio Build Tools (Desktop C++)
  - **macOS** : Xcode Command Line Tools
- Un projet [Supabase](https://supabase.com) et un bucket
  [Cloudflare R2](https://developers.cloudflare.com/r2/) (pour une instance
  autonome).

### Lancer en local
```bash
cd vision
npm install
npm run tauri dev
```

> La première compilation Rust est longue ; les suivantes sont incrémentales
> (~quelques secondes). Après une modification du schéma SQLite (migrations dans
> `src-tauri/src/lib.rs`), redémarrer `tauri dev` (Ctrl+C puis relancer).

### Configurer son propre backend
1. Renseigner l'URL et la clé anon du projet Supabase dans
   `vision/src/services/supabase.js`.
2. Exécuter [`vision/supabase/phase0.sql`](vision/supabase/phase0.sql) dans le
   SQL Editor de Supabase (tables, RLS, RPC).
3. Déployer l'Edge Function
   [`vision/supabase/functions/r2-sign`](vision/supabase/functions/r2-sign) et
   y configurer les secrets `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`,
   `R2_BUCKET`, `R2_PUBLIC_DOMAIN`.
4. Ajouter la règle CORS sur le bucket R2 (voir le guide de déploiement).

## Structure du projet

```
vision/
├── src/                      # Frontend Vue
│   ├── pages/                # Dashboard, Auth, Settings, espace projet (onglets)
│   │   └── project/          # AboutTab, MoodboardTab, GalleryTab, ValidationTab,
│   │                         #   DeliveryTab, FeedbackTab
│   ├── components/           # Modales, sidebar, toaster, dialog de confirmation…
│   ├── store/                # État réactif par domaine (projects, media, comments,
│   │                         #   validations, invites, session, toast…)
│   ├── services/             # Accès aux données : db (SQLite), sync (Supabase),
│   │                         #   r2, auth, supabase, files, dialogs, screenGuard
│   └── composables/          # useFileDrop, useProjectRealtime, useTheme, useOnboarding
├── src-tauri/                # Côté natif (Rust)
│   ├── src/lib.rs            # Commandes (génération de miniatures) + migrations SQLite
│   ├── capabilities/         # Permissions Tauri
│   └── tauri.conf.json       # Config app, CSP, scope du protocole asset
├── supabase/                 # phase0.sql (RLS + RPC) + Edge Function r2-sign
└── docs/                     # Documentation (déploiement, fonctionnement)
```

## Build & release

Les binaires sont produits par GitHub Actions
([`.github/workflows/release.yml`](.github/workflows/release.yml)) à chaque push
sur `main` :

- Un job crée **une** release (en brouillon).
- Deux jobs (Windows + macOS universel) compilent et y attachent leurs binaires.
- La release reste en brouillon : vérifier que tous les fichiers sont présents,
  puis la publier manuellement.

Pour une nouvelle version, **incrémenter le numéro** dans
`vision/src-tauri/tauri.conf.json` (et `vision/package.json`) avant de pousser,
afin d'obtenir une release propre et séparée.

> ℹ️ Il n'y a pas (encore) de mise à jour automatique : sur macOS, chaque
> nouvelle version implique de réinstaller le DMG et de relancer la commande
> `xattr`.

## Feuille de route

L'état détaillé et priorisé est dans [`vision/TODO.md`](vision/TODO.md).
Grandes lignes à venir :

- **Protection média robuste** : aperçus basse-déf filigranés + originaux en
  bucket privé avec accès signé.
- **Client web** (zéro installation) pour les clients.
- **Notifications email** (nouvel avancement à valider).
- **Versionnage des retouches**, branding du créatif, formats de livraison.

Hors périmètre (choix produit) : paiement intégré, quotas payants, application
mobile.

---

<div align="center">
<sub>Projet privé — collaboration créatif ↔ client.</sub>
</div>
