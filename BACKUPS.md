# Sauvegardes de Budget Bloom

Chaque nuit, GitHub copie la base Supabase, la chiffre, puis l'envoie sur Infomaniak dans le dossier `~/budget-bloom-backups`, en dehors du site.

- **Contenu** : budgets, dépenses, revenus, épargne, foyers, comptes et préférences.
- **Non inclus** : les fichiers des photos de profil. Chacun peut remettre sa photo.
- **Conservation** : les 30 derniers jours, plus une copie par mois pendant 12 mois.
- **En cas d'échec** : GitHub envoie un email et la tâche apparaît en rouge dans l'onglet **Actions**.

## La clé de déchiffrement

Elle se trouve dans `C:\Users\primo\.budget_bloom\backup-age-key.txt`.

**Sans cette clé, aucune sauvegarde ne peut être relue.** Garde-en une copie hors de ce PC, par exemple dans un gestionnaire de mots de passe. Ne la mets jamais sur GitHub ni sur Infomaniak.

## Restaurer

Restaure toujours d'abord dans un **nouveau projet Supabase vide**, pour vérifier les données sans toucher à la base en service.

1. Installe les outils : `winget install FiloSottile.age` et `winget install PostgreSQL.PostgreSQL.17`.
2. Télécharge le fichier voulu depuis `~/budget-bloom-backups` (par FTP ou SSH).
3. Déchiffre-le :

   ```powershell
   age -d -i "$env:USERPROFILE\.budget_bloom\backup-age-key.txt" -o base.dump budget-bloom-AAAA-MM-JJ.dump.age
   ```

4. Exécute les migrations de `supabase/migrations` dans le nouveau projet, puis recharge les données :

   ```powershell
   pg_restore --data-only --disable-triggers --no-owner --schema=public --schema=auth -d "ADRESSE_DU_NOUVEAU_PROJET" base.dump
   ```

5. Vérifie les données, puis fais pointer l'appli vers ce projet.
6. Supprime `base.dump` : ce fichier n'est pas chiffré.
