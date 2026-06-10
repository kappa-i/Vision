# Cahier des charges — App de collaboration créatif ↔ client

> *Nom provisoire : à définir*
> Document de cadrage — v0.1

---

## 1. Vision

Une application desktop partagée entre un **créatif** (photographe, graphiste, directeur artistique) et son **client**, qui centralise tout ce qui concerne un projet créatif : de la direction artistique jusqu'à la livraison finale.

L'app vit des deux côtés : le créatif crée l'espace projet, le client installe l'app et y accède. Tout est synchronisé entre les deux.

---

## 2. Problématique

> **Le créatif et son client n'ont jamais le même niveau de vision sur un projet — l'un crée, l'autre réagit dans le vide.**

Aujourd'hui, le feedback se disperse entre mails, WhatsApp, WeTransfer et appels. Résultat : allers-retours interminables, malentendus sur la direction artistique, perte de temps, client peu impliqué.

**Promesse :** donner au client la même clarté que le créatif a en tête, à chaque étape du projet.

---

## 3. Positionnement

| | |
|---|---|
| **Ce que ce n'est pas** | Un outil de gestion de projet générique (Notion, Trello) |
| **Ce que ce n'est pas** | Un simple outil de transfert de fichiers (WeTransfer, Frame.io) |
| **Ce que c'est** | Une app pensée pour la **relation créatif ↔ client**, centrée sur la vision et la validation |

---

## 4. Cibles

- **Utilisateur principal :** photographes, graphistes, directeurs artistiques (freelance ou petite structure)
- **Utilisateur secondaire :** le client du créatif (souvent non-technique)

---

## 5. Stack technique

| Couche | Techno | Notes |
|---|---|---|
| **App desktop** | Tauri | App native légère (~5–10 Mo), `.exe` Windows |
| **Frontend** | Vue 3 + Vite | Composition API |
| **Styling** | À définir (Tailwind ?) | UI minimaliste et aérée |
| **Backend / sync** | À définir | Cloud léger vs peer-to-peer (voir §9) |
| **Stockage local** | SQLite (via Tauri) | Cache local des projets et médias |
| **Auth** | À définir | Compte créatif + invitation client |

---

## 6. Rôles & permissions

| Action | Créatif | Client |
|---|---|---|
| Créer un projet | ✅ | ❌ |
| Inviter | ✅ | ❌ |
| Uploader des médias | ✅ | ❌ |
| Éditer le moodboard | ✅ | ❌ |
| Commenter / annoter | ✅ | ✅ |
| Valider / rejeter | ❌ | ✅ |
| Voir la timeline | ✅ | ✅ |

---

## 7. Pages & fonctionnalités

### 7.1 Dashboard (créatif)
- Liste des projets en cours
- Statut de chaque projet (brouillon, en attente de validation, livré)
- Création rapide d'un nouveau projet

### 7.2 Espace projet
Cœur de l'app. Organisé en sections :

**a) Moodboard**
- Le créatif pose sa direction artistique (images de référence, couleurs, typos, notes)
- Le client peut commenter / réagir
- Disposition libre (grille ou canvas)

**b) Galerie d'avancement**
- Photos brutes et versions retouchées, organisées par étape
- Comparaison avant / après
- Le client peut étoiler, commenter, annoter directement sur l'image

**c) Validation**
- Le client approuve ou rejette une sélection
- Statut visible des deux côtés (en attente / validé / à revoir)
- Historique des versions

**d) Timeline projet**
- Étapes claires (brief → shoot → sélection → retouche → livraison)
- Chacun sait où on en est
- Dates clés

**e) Feedback centralisé**
- Tous les commentaires regroupés, rattachés à un visuel ou une étape
- Fini les retours éparpillés

### 7.3 Livraison
- Espace final où le client télécharge les fichiers approuvés
- Formats / résolutions définis par le créatif

### 7.4 Paramètres
- Profil, gestion des invitations, préférences

---

## 8. Parcours utilisateur (flux principal)

1. Le créatif crée un projet et définit les étapes
2. Il monte le moodboard et invite le client
3. Le client installe l'app, ouvre le projet, valide la direction
4. Le créatif uploade l'avancement étape par étape
5. Le client annote, commente, valide ou demande des révisions
6. Une fois tout validé → livraison des fichiers finaux

---

## 9. Questions ouvertes / à trancher

- **Mode de sync :** cloud léger (compte + serveur) ou peer-to-peer direct entre machines ?
- **Le client doit-il vraiment installer une app desktop**, ou un accès web allégé serait préférable pour lui ?
- **Modèle économique :** achat unique, abonnement, freemium ?
- **Stockage des médias :** local uniquement, cloud, ou hybride ?
- **Nom du produit** (à définir)

---

## 10. Périmètre MVP (proposition)

Pour une première version livrable, se concentrer sur :

1. Création de projet + invitation
2. Moodboard simple
3. Galerie d'avancement avec commentaires
4. Validation basique (approuvé / à revoir)

Le reste (timeline détaillée, livraison avancée, annotations précises) en v2.

---

*Document évolutif — à compléter au fil des décisions.*
