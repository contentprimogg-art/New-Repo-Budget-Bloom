-- Notifications: appareils abonnés, préférences, anti-doublons, et appels vers la fonction « notify »
-- (Supabase Edge Function) à chaque nouvelle dépense et toutes les heures (bilans, rappels).
--
-- Avant d'exécuter: remplacez ikmjlqczailvtmqhfxsy plus bas par l'identifiant du projet Supabase
-- (le début de l'adresse https://ikmjlqczailvtmqhfxsy.supabase.co).

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 1. Appareils qui reçoivent les notifications (un compte peut en avoir plusieurs).
--    kind = 'web' (navigateur / appli installée depuis le navigateur) ou 'fcm' (APK Android).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('web', 'fcm')),
  endpoint text not null unique,
  p256dh text,
  auth text,
  user_agent text,
  created_at timestamptz not null default now(),
  check (kind = 'fcm' or (p256dh is not null and auth is not null))
);
alter table push_subscriptions enable row level security;
create policy "abonnements: les siens" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Préférences de chacun (valables sur tous ses appareils).
create table notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  expenses boolean not null default true,   -- dépense ajoutée par un autre membre du foyer
  envelopes boolean not null default true,  -- enveloppe à 80 %, puis dépassée
  weekly boolean not null default true,     -- bilan du dimanche soir
  reminders boolean not null default true,  -- rien noté depuis 7 jours, nouveau mois
  lang text not null default 'fr' check (lang in ('fr', 'en')),
  updated_at timestamptz not null default now()
);
alter table notification_settings enable row level security;
create policy "préférences: les siennes" on notification_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Notifications déjà envoyées (une alerte « 80 % » par enveloppe, un bilan par semaine…).
--    Réservé au serveur: aucune politique, donc invisible depuis l'app.
create table notification_log (
  key text primary key,
  sent_at timestamptz not null default now()
);
alter table notification_log enable row level security;

-- 4. Secret partagé entre la base et la fonction: tiré au hasard ici, il ne quitte jamais Supabase.
--    La fonction le vérifie via push_secret_ok(), accessible uniquement au rôle serveur.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'bloom_push_secret');

create function push_secret_ok(candidate text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'bloom_push_secret' and decrypted_secret = candidate)
$$;
revoke all on function push_secret_ok(text) from public, anon, authenticated;
grant execute on function push_secret_ok(text) to service_role;

-- Appel de la fonction « notify » (asynchrone: n'attend pas la réponse, ne bloque jamais l'enregistrement).
create function call_notify(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'bloom_push_secret';
  perform net.http_post(
    url := 'https://ikmjlqczailvtmqhfxsy.supabase.co/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bloom-secret', secret)
  );
end $$;
revoke all on function call_notify(jsonb) from public, anon, authenticated;

-- 5. Nouvelle dépense → notification aux autres membres, et alerte si l'enveloppe approche du budget.
create function notify_expense() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform call_notify(jsonb_build_object('type', 'expense', 'id', new.id));
  return new;
end $$;

create trigger notify_expense after insert on expenses
  for each row execute function notify_expense();

-- 6. Toutes les heures: la fonction regarde l'heure de Paris et envoie bilans et rappels au bon moment.
select cron.schedule('bloom-notify-tick', '5 * * * *', $$select call_notify('{"type":"tick"}'::jsonb)$$);
