# Site de la formation — michben

Site statique (HTML/CSS/JS, aucune dépendance) en deux parties :

- `index.html` — page publique de vente (programme, tarifs, bouton Stripe, bouton Calendly).
- `espace-prive/index.html` — espace réservé aux personnes ayant payé, protégé par un **code d'accès**. Contient les modules complets des deux formations, les 4 fiches à compléter, et le lien Calendly de suivi.

## Comment fonctionne la protection de l'espace privé

Il n'y a pas de serveur/backend : c'est un site 100% statique. L'accès est donc protégé par un **code secret** (comme une invitation), pas par un vrai compte utilisateur :

1. Le code par défaut est : **`MICHBEN-CLAUDE-2026`**
2. Seule l'empreinte SHA-256 du code est stockée dans `espace-prive/app.js` (jamais le code en clair).
3. Une fois le bon code saisi, le navigateur du client le retient (il n'a pas besoin de le retaper à chaque visite sur le même appareil).

**Après chaque paiement reçu sur Stripe**, vous envoyez manuellement au client un email avec :
- le lien vers `espace-prive/index.html` (ex: `https://votre-domaine.fr/espace-prive/`)
- le code d'accès `MICHBEN-CLAUDE-2026`

⚠️ **Limite à connaître** : toute personne qui obtient le lien + le code peut entrer (pas de vérification automatique du paiement). C'est un niveau de protection "sur invitation", suffisant pour une petite formation avec un accompagnement humain, mais pas une vraie authentification. Si vous voulez plus tard :
- un **code unique par client** (révocable),
- une **vérification automatique du paiement Stripe** (webhook) qui génère et envoie le lien tout seul,

il faudra ajouter un petit backend (ex: une fonction serverless + une base de données). Dites-le moi si vous voulez que je le construise.

### Changer le code d'accès

Dites-moi le nouveau code et je mettrai à jour l'empreinte, ou faites-le vous-même :
1. Ouvrez une console de navigateur (F12) sur n'importe quelle page **en http/https** (pas en fichier local) et lancez :
   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("VOTRE-NOUVEAU-CODE".toUpperCase().trim()))
     .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")))
   ```
2. Copiez le résultat (64 caractères) dans `espace-prive/app.js`, variable `ACCESS_HASH`.

## Prévisualiser en local

Aucun serveur Python/Node n'est installé sur cette machine. Un petit script PowerShell est fourni pour tester le site en local (nécessaire pour que le code d'accès fonctionne, voir plus bas) :

```powershell
powershell -ExecutionPolicy Bypass -File ".claude\serve.ps1"
```

Puis ouvrez `http://localhost:5588/` dans un navigateur. Arrêtez-le avec Ctrl+C dans son terminal (ou fermez la fenêtre).

## Mise en ligne

C'est un site statique : il peut être déposé tel quel sur n'importe quel hébergement (Netlify, Vercel, GitHub Pages, OVH, o2switch, etc.). Aucune étape de build n'est nécessaire — uploadez le dossier tel qu'il est.

Le fichier `robots.txt` empêche déjà les moteurs de recherche d'indexer `/espace-prive/`.

⚠️ **Important** : le code d'accès (`crypto.subtle`) ne fonctionne que sur une page servie en **HTTPS** (ou `http://localhost` pour tester). Si vous ouvrez `index.html` directement en double-cliquant sur le fichier, la vérification du code échouera — c'est normal, testez toujours via un vrai hébergement ou un serveur local.

## Liens utilisés

- Paiement Stripe (⚠️ actuellement en **mode test** — voir note ci-dessous) :
  - Claude Code dans le terminal (250 €) : `https://buy.stripe.com/test_7sYcN51a23fn3Hab2f7kc00`
  - Fly Connectome & IA bio-inspirée (250 €) : `https://buy.stripe.com/test_eVqcN53iag29gtWfiv7kc01`
  - Pack des deux formations (400 €) : `https://buy.stripe.com/test_8x24gzcSKbLT6Tm5HV7kc02`

  ⚠️ Ces 3 liens commencent par `buy.stripe.com/test_...` : ils sont en **mode test** et n'encaissent pas de vrai argent (utile pour vérifier que tout s'affiche bien, mais aucun client ne peut payer avec). Pour passer en production : basculez votre compte Stripe en mode Live (bouton en haut du Dashboard), recréez les 3 liens dans ce mode, puis donnez-les-moi pour mise à jour du site.
- Réservation Calendly : `https://calendly.com/michben`
- Contact : uniquement via Calendly (`https://calendly.com/michben`) — email et téléphone volontairement non affichés sur le site

Pensez à vérifier/adapter : durée exacte des formations, format (distanciel/présentiel), date de fin de l'offre à -100€, conditions d'annulation — ces points sont listés dans le support de cours PDF comme "à préciser dans le devis".
