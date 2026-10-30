# Mise en ligne

Une PWA est un site web: pour l'installer sur iPhone (Safari → Partager → « Sur l'écran d'accueil »), elle doit être servie en **HTTPS**. Le dépôt GitHub peut rester privé.

## Cloudflare Pages (recommandé, gratuit)

1. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → choisir ce dépôt.
2. Réglages de build:
   - Framework preset: `Vite` (ou aucun)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Variable d'environnement `NODE_VERSION`: `22`
3. Variables d'environnement (Production et Preview):
   - `VITE_SUPABASE_URL` = `https://xxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = clé anon / publishable
4. Déployer. Chaque `git push` sur `main` redéploie.

`public/_redirects` renvoie toutes les routes vers `index.html`.

## Après le premier déploiement

Dans Supabase → Authentication → URL Configuration:
- **Site URL**: l'adresse du site déployé (ex. `https://budget-bloom.pages.dev`)
- **Redirect URLs**: ajouter la même adresse (et `http://localhost:5173` pour le développement)

Sans ça, le lien de confirmation par e-mail pointe vers `localhost`.

## Vercel (alternative)

Importer le dépôt, preset Vite, mêmes deux variables d'environnement.
