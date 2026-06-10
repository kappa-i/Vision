# Vision — TODO

Liste des évolutions, court et long terme. Voir aussi la réflexion produit :
[`docs/fonctionnement.md`](docs/fonctionnement.md).

> 💡 La quasi-totalité du long terme se débloque avec une seule fondation : le
> **backend (Supabase)**. Le court terme est faisable dès maintenant, sans backend.

---

## 🟢 Court terme — UX & finition (sans backend)

- [x] Validation en masse depuis la grille (approuver/refuser sans ouvrir chaque photo) + bouton « Tout approuver »
- [x] Tri & recherche (galerie : tri récent/ancien/nom · projets : recherche par nom)
- [x] « Tout télécharger » à la livraison (copie vers un dossier choisi)
- [x] Favoris client (♥), distinct de la validation
- [x] Clarifier les 2 zones de commentaires (annotations sur image vs Feedback global)
- [x] Marquer une annotation comme « résolue »
- [x] Confirmations sur les suppressions (photo, référence)
- [x] Erreurs visibles via toasts (fichier non-image ignoré, etc.)
- [x] Chargement progressif des vignettes (lazy-load)
- [x] Protection écran désactivée côté créatif (active seulement pour le client)
- [x] Nettoyer le statut « En attente » (supprimé)
- [x] Écran vide guidé sur le Dashboard
- [ ] Sélection multiple par cases à cocher (suppression groupée) — *partiel : bulk « Tout approuver » fait*
- [ ] Undo (annuler une suppression)
- [ ] Onboarding 1er lancement (visite guidée)
- [ ] Multi-langue (i18n)

---

## 🔵 Long terme — structurel & stratégique

- [x] Vraie identité / auth → supprimer le sélecteur de rôle (Supabase Auth)
- [ ] Invitation par lien (email) au lieu d'un code
- [x] Synchronisation cloud (2 machines voient le même projet — Supabase + Realtime)
- [ ] Client sur le web (zéro installation)
- [ ] Notifications email / push
- [x] Stockage médias cloud + sauvegarde (Cloudflare R2)
- [ ] Protection image solide (aperçus basse-déf + filigrane + liens signés)
- [ ] Versionnage des livrables / historique des révisions
- [ ] Formats & résolutions de livraison définissables
- [ ] Modèle économique (abonnement créatif, client gratuit)
- [ ] Performance sur gros volumes (centaines de photos)
- [ ] Mobile / responsive

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
- [x] Invitation client (code local)
- [x] Non-lus (pastilles locales, par rôle)
- [x] Protections desktop (clic droit off, capture d'écran noire)
