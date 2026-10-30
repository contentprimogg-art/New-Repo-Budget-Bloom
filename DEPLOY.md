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

## Infomaniak (déploiement automatique par SSH)

Le workflow `.github/workflows/deploy.yml` construit l'app et envoie `dist/` sur l'hébergement à chaque `git push` sur `main`.
Tant qu'un secret manque, l'étape d'envoi est simplement ignorée.

Secrets GitHub (Settings → Secrets and variables → Actions → New repository secret):

| Secret | Contenu |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` (sans `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | clé anon / publishable de Supabase (jamais la `service_role`) |
| `SSH_HOST` | serveur SSH de l'hébergement (Manager → Hébergement web → Connexions FTP/SSH) |
| `SSH_USER` | identifiant SSH |
| `SSH_PATH` | dossier du site sur le serveur, ex. `/home/clients/xxxx/sites/mon-site.fr` |
| `SSH_KEY` | clé **privée** dédiée au déploiement (voir ci-dessous) |

### Créer la clé SSH (PowerShell, sur ton PC)

```powershell
ssh-keygen -t ed25519 -C "budget-bloom-deploy" -f "$HOME\.ssh\budget_bloom_deploy" -N '""'
```

Cela crée deux fichiers: `budget_bloom_deploy` (privée, secrète) et `budget_bloom_deploy.pub` (publique).
Cette clé n'a pas de mot de passe (nécessaire pour un déploiement automatique): elle ne doit servir qu'à ce site.

1. **Clé publique → Infomaniak.** Soit dans le Manager (gestion des clés SSH de la connexion), soit depuis le terminal:
   ```powershell
   Get-Content "$HOME\.ssh\budget_bloom_deploy.pub" | ssh SSH_USER@SSH_HOST "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
   ```
2. **Clé privée → secret `SSH_KEY`.** Ouvre `budget_bloom_deploy` (sans extension) avec un éditeur de texte, copie **tout** le contenu
   (de `-----BEGIN OPENSSH PRIVATE KEY-----` à `-----END OPENSSH PRIVATE KEY-----`, saut de ligne final compris) et colle-le dans le secret.
   Ne la partage jamais, ne la mets pas dans le dépôt.
3. **Trouver `SSH_PATH`.** Connecte-toi une fois, puis regarde où est le dossier de ton site:
   ```powershell
   ssh -i "$HOME\.ssh\budget_bloom_deploy" SSH_USER@SSH_HOST
   pwd
   ls
   ```
   Le dossier du site (celui qui contient, ou contiendra, `index.html`) est celui indiqué dans le Manager comme « dossier racine » du site.

### Après le premier déploiement
- Dans Supabase → Authentication → URL Configuration: mets l'adresse du site en **Site URL** et dans **Redirect URLs**.
- Dans le Manager Infomaniak: active le certificat SSL du site et la redirection HTTPS (nécessaire pour installer la PWA sur iPhone).
- Le workflow n'efface jamais de fichiers sur le serveur (pas de `--delete`): les anciens fichiers de `assets/` s'accumulent, tu peux les supprimer à la main de temps en temps.
