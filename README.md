# Budget Bloom 🌸

Application de budget par enveloppes (PWA), pour un usage privé: chaque dépense va dans son enveloppe, avec le restant et le pourcentage en temps réel, le montant du dépassement, et un foyer partagé entre plusieurs personnes.

**Stack:** Vite · React · TypeScript · Tailwind v4 · PWA (`vite-plugin-pwa`) · Supabase (auth + Postgres) · i18next (FR/EN).

## Démarrer en local

```bash
npm install
cp .env.example .env   # puis renseigner l'URL et la clé anon/publishable de Supabase
npm run dev            # http://localhost:5173 (et http://<IP du PC>:5173 depuis le téléphone, même Wi-Fi)
```

L'URL Supabase est de la forme `https://xxxx.supabase.co` (sans `/rest/v1/`).
Ne jamais mettre la clé `service_role` dans `.env`.

## Base de données

Les migrations sont dans `supabase/migrations/`. À exécuter **dans l'ordre, une seule fois chacune**, dans le SQL Editor de Supabase:

1. `0001_init.sql`: foyers, enveloppes, dépenses, soldes, sécurité par ligne (RLS)
2. `0002_expense_status.sql`: statut de remboursement
3. `0003_recurring_envelopes.sql`: enveloppes récurrentes
4. `0004_savings.sql`: épargne (enveloppes, sous-enveloppes, paliers, mouvements)
5. `0005_avatars.sql`: stockage privé des photos de profil
6. `0006_groups_realtime.sql`: groupes d'enveloppes, icônes de l'épargne, mise à jour en direct entre appareils
7. `0007_avatar_formats.sql`: photos de profil en GIF et jusqu’à 5 Mo

## Aperçu des composants (développement)

`npm run dev` puis ouvrir `http://localhost:5173/#/__preview` (ou `#/__preview-quick` pour le panneau d'ajout rapide): les composants du style calligraphique avec des données fictives, sans connexion. Cette page n'existe pas dans la version en ligne.

Le modèle d'e-mail de confirmation est dans `supabase/email-templates/` (à coller dans Authentication → Emails → Templates; nécessite un SMTP personnalisé).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification des types + build de production (`dist/`) |
| `npm run preview` | prévisualiser le build |
| `node scripts/make-icons.mjs` | régénérer les icônes PNG depuis `branding/` |
| `node scripts/build-emojis.mjs` | régénérer le catalogue d'emojis (`src/data/emojis.json`) |

## Mise en ligne (HTTPS, nécessaire pour installer la PWA sur iPhone)

Voir [DEPLOY.md](DEPLOY.md).
