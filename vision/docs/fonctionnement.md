# Vision — Réflexion sur le fonctionnement

> Document de réflexion produit/technique. Complète le cahier des charges
> (`../../cahier-des-charges.md`), en particulier les **questions ouvertes §9**.

## 1. Où en est l'app aujourd'hui

L'app est **fonctionnelle en local, sur une seule machine** :

- Projets, Moodboard, Galerie (upload images réel), Validation, Timeline,
  Livraison, Feedback — le tout **persisté en SQLite local** (`vision.db`).
- Le **rôle** Créatif / Client est un **interrupteur manuel** (sidebar). Il
  simule les deux points de vue pour démontrer les permissions (§6).

C'est un **prototype mono-poste complet** : parfait pour valider l'UX et les
flux, mais il **ne connecte pas encore deux personnes sur deux machines**.

## 2. Le vrai cœur manquant : la collaboration à distance

La promesse du produit (§1–2) est *relationnelle* : le créatif et le client
vivent le **même projet**, chacun de son côté, en temps quasi réel. Trois
briques manquent pour ça :

| Brique | Aujourd'hui | Cible |
|---|---|---|
| **Identité** | aucun compte | compte créatif + accès client |
| **Invitation** | toggle de rôle | lien/code d'invitation par projet |
| **Synchronisation** | SQLite local isolé | partage des données + médias entre 2 postes |

Tant que ces briques n'existent pas, le rôle restera un simulateur. Elles sont
donc **la prochaine priorité structurante**.

## 3. Synchronisation : cloud léger vs peer-to-peer (§9)

**Recommandation : cloud léger.**

| Critère | Cloud léger ✅ | Peer-to-peer |
|---|---|---|
| Les 2 en ligne en même temps | non requis | **requis** |
| Traversée NAT / pare-feu | non concerné | difficile, fragile |
| Médias lourds (RAW, retouches) | object storage adapté | transfert direct lourd |
| Historique / reprise | naturel (serveur source de vérité) | complexe |
| Public non-technique | transparent | source de bugs |

Le P2P séduit sur le papier (pas de serveur, confidentialité) mais s'effondre
sur le cas d'usage réel : un client non-technique qui ouvre l'app **quand le
créatif n'est pas là**. Le cloud léger gagne.

**Architecture proposée (offline-first) :**

```
Créatif (desktop)  ┐
                   ├─►  API + Postgres (métadonnées)  +  Object storage (médias)
Client (web/app)   ┘            ▲ source de vérité
        │
        └─ SQLite local = cache : push/pull des deltas, marche hors-ligne
```

Le `services/sync.js` déjà en place fige ce contrat (`push`/`pull`,
`SYNC_MODES`). Il suffira d'y brancher l'implémentation cloud.

Pistes concrètes : un backend managé (Supabase / PocketBase) pour aller vite,
ou un petit service maison (Postgres + S3/R2). Démarrer managé, internaliser
plus tard si besoin.

## 4. Le client doit-il installer l'app ? (§9)

**Recommandation : le client passe par le web, le créatif par le desktop.**

Demander à un client non-technique d'installer un `.exe` est un frein majeur.
Or le frontend est en **Vue + Vite** : il tourne **aussi bien en web qu'en
Tauri**. Le code contient déjà l'aiguillage `isTauri()`.

- **Créatif** → app desktop Tauri (gros fichiers, accès disque, confort).
- **Client** → **lien web** (zéro installation), même UI, permissions limitées.

Un seul codebase, deux cibles de build. C'est le meilleur rapport effort/valeur.

## 5. Stockage des médias (§9)

**Hybride, recommandé :**

- **Originaux** (RAW, exports HD) → object storage cloud.
- **Aperçus / thumbnails** → générés et **mis en cache localement** (vitesse,
  hors-ligne).
- La table `media` stocke aujourd'hui un **chemin local** ; elle évoluera vers
  une **clé de stockage** (+ URL signée) une fois le cloud branché.

## 6. Du toggle au vrai rôle

Le rôle deviendra une **conséquence de l'identité**, pas un choix :

1. Le créatif se connecte (son compte) → rôle Créatif.
2. Il invite le client (lien/code rattaché au projet).
3. Le client ouvre le lien → rôle Client sur **ce** projet uniquement.

Le `store/session.js` (capacités dérivées du rôle) est déjà structuré pour ça :
seule la **source** du rôle changera (auth au lieu de bouton).

## 7. Chemin pragmatique recommandé

1. **(fait)** Prototype mono-poste complet — valider l'UX.
2. **Auth + invitation** (compte créatif, lien client).
3. **Sync cloud** des métadonnées (projets, commentaires, validations, étapes).
4. **Médias cloud** (upload → storage, URL signées, cache local).
5. **Build web du client** (même UI, cible navigateur).
6. Raffinements : annotations sur image, notifications, comparaison avant/après.

## 8. Modèle économique (§9) — piste

Cible = freelances : **abonnement créatif** (le client n'paie jamais, il est
invité). Palier gratuit (1–2 projets actifs) → payant (projets illimités,
stockage, marque blanche). L'abonnement finance le coût serveur/stockage, ce
qui **renforce le choix du cloud léger** plutôt que le P2P.
