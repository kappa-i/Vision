# Vision

App desktop de collaboration **créatif ↔ client** (photographe, graphiste, DA).
Centralise direction artistique, avancement, feedback et validation d'un projet
créatif. Voir le cahier des charges : [`../cahier-des-charges.md`](../cahier-des-charges.md).

## Stack

- **Tauri 2** — app native légère (`.exe` Windows)
- **Vue 3** (Composition API, JavaScript) + **Vite 6**
- **Tailwind CSS v4** — UI minimaliste et aérée
- **SQLite** via `tauri-plugin-sql` — cache local (projets, médias, commentaires, validations)
- **Vue Router** — navigation entre pages

## Prérequis

- **Node.js** ≥ 18 (testé sur v22)
- **Rust** + **Visual Studio C++ Build Tools** (Windows) — requis pour compiler l'app desktop.
  Installer via <https://www.rust-lang.org/tools/install> puis voir
  <https://tauri.app/start/prerequisites/>.

> Sans Rust, on peut quand même développer l'UI dans le navigateur (`npm run dev`).
> Le cache SQLite n'est actif que dans le runtime Tauri.

## Démarrage

```bash
npm install

# UI seule dans le navigateur (sans Tauri, sans SQLite)
npm run dev

# App desktop complète (nécessite Rust)
npm run tauri dev

# Build .exe de production
npm run tauri build
```

## Structure

```
src/
  pages/            Dashboard, Espace projet (Moodboard/Galerie/Validation), Paramètres
  components/       Sidebar, sélecteur de rôle
  store/            session (rôle + permissions §6), projects
  services/         db (SQLite), sync (abstraction local/cloud/p2p §9)
  router/           routes (périmètre MVP §10)
src-tauri/
  src/lib.rs        init Tauri + migrations SQLite
  capabilities/     permissions (sql, opener)
  tauri.conf.json   config app / fenêtre
```

## Rôles

L'app vit des deux côtés avec le même binaire. Le **point de vue** (Créatif / Client)
se bascule en bas de la sidebar et conditionne les permissions
(création, upload, édition moodboard vs validation). Source unique :
`src/store/session.js`.

## Périmètre actuel

Mono-poste, tout persisté en SQLite local :

- ✅ Dashboard + statuts de projet
- ✅ Moodboard (références images, upload natif)
- ✅ Galerie d'avancement (upload, étoilage)
- ✅ Validation (décision, historique, pilote le statut projet)
- ✅ Timeline (étapes brief → livraison)
- ✅ Livraison (téléchargement des fichiers approuvés)
- ✅ Feedback centralisé
- 🚧 À venir : authentification, invitation client, **synchronisation cloud**,
  médias cloud, build web du client, annotations sur image.

> Le passage du prototype mono-poste à la vraie collaboration à distance est
> détaillé dans [`docs/fonctionnement.md`](docs/fonctionnement.md).
