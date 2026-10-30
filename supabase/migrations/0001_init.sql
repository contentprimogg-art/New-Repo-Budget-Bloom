-- Budget Bloom: schéma initial. À exécuter dans Supabase (SQL Editor) ou via `supabase db push`.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (household_id, user_id)
);

-- Une enveloppe appartient à un mois ('YYYY-MM'): l'historique est conservé par construction
-- et le passage au mois suivant copie simplement les enveloppes.
-- kind = 'spending' (courses, loisirs...) ou 'savings'; parent_id = sous-enveloppe d'épargne.
create table envelopes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  name text not null,
  kind text not null default 'spending' check (kind in ('spending', 'savings')),
  parent_id uuid references envelopes(id) on delete cascade,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  color text,
  icon text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on envelopes (household_id, month);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  envelope_id uuid not null references envelopes(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  spent_on date not null default current_date,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on expenses (envelope_id);
create index on expenses (household_id, spent_on);

create table month_balances (
  household_id uuid not null references households(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  start_balance numeric(12,2),
  end_balance numeric(12,2),
  primary key (household_id, month)
);

-- Sécurité: seules les personnes membres d'un foyer voient / modifient ses données.
create function is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid());
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table envelopes enable row level security;
alter table expenses enable row level security;
alter table month_balances enable row level security;

create policy "membres: lecture foyer" on households for select using (is_member(id));
create policy "membres: lecture membres" on household_members for select using (is_member(household_id));
create policy "membres: quitter" on household_members for delete using (user_id = auth.uid());

create policy "membres: envelopes" on envelopes for all using (is_member(household_id)) with check (is_member(household_id));
create policy "membres: expenses" on expenses for all using (is_member(household_id)) with check (is_member(household_id));
create policy "membres: month_balances" on month_balances for all using (is_member(household_id)) with check (is_member(household_id));

-- Création / adhésion à un foyer (le code d'invitation se partage avec la conjointe, les amis...).
create function create_household(h_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into households (name) values (h_name) returning id into h;
  insert into household_members (household_id, user_id) values (h, auth.uid());
  return h;
end $$;

create function join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select id into h from households where invite_code = lower(code);
  if h is null then raise exception 'invalid invite code'; end if;
  insert into household_members (household_id, user_id) values (h, auth.uid()) on conflict do nothing;
  return h;
end $$;

revoke all on function create_household, join_household from public, anon;
grant execute on function create_household, join_household to authenticated;
