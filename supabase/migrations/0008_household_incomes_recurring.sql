-- Devise du foyer, revenus, dépenses récurrentes, profils visibles par le foyer.

-- 1. Devise du foyer (code ISO 4217: EUR, USD, GBP, CHF…)
alter table households add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$');
create policy "membres: modifier foyer" on households for update using (is_member(id)) with check (is_member(id));

-- 2. Lignée des enveloppes: « la même » enveloppe d'un mois à l'autre (la reconduction la conserve).
alter table envelopes add column lineage_id uuid;
with recursive chain as (
  select id, id as root from envelopes where source_id is null
  union all
  select e.id, c.root from envelopes e join chain c on e.source_id = c.id
)
update envelopes e set lineage_id = chain.root from chain where chain.id = e.id;
update envelopes set lineage_id = id where lineage_id is null;

create function envelopes_lineage() returns trigger
language plpgsql as $$
begin
  if new.lineage_id is null then new.lineage_id := new.id; end if;
  return new;
end $$;
create trigger envelopes_lineage before insert on envelopes for each row execute function envelopes_lineage();

alter table envelopes add column created_by uuid references auth.users(id) on delete set null default auth.uid();

-- 3. Dépenses récurrentes: un modèle par dépense qui revient (ex. « Pneus » dans « Voiture », chaque année).
create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  lineage_id uuid not null,
  note text,
  amount numeric(12,2) not null check (amount > 0),
  every_months int not null check (every_months in (1, 2, 3, 6, 12)),
  day int not null default 1 check (day between 1 and 31),
  next_month text not null check (next_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on recurring_expenses (household_id, next_month);
alter table recurring_expenses enable row level security;
create policy "membres: recurring_expenses" on recurring_expenses for all
  using (is_member(household_id)) with check (is_member(household_id));

alter table expenses add column recurring_id uuid references recurring_expenses(id) on delete set null;

-- 4. Revenus du mois (salaire, remboursements, ventes…); « recurring » = recopié chaque mois.
create table incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  label text not null,
  amount numeric(12,2) not null check (amount > 0),
  received_on date not null default current_date,
  recurring boolean not null default false,
  icon text,
  color text,
  source_id uuid references incomes(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on incomes (household_id, month);
create unique index incomes_source_month on incomes (source_id, month) where source_id is not null;
alter table incomes enable row level security;
create policy "membres: incomes" on incomes for all
  using (is_member(household_id)) with check (is_member(household_id));

-- Jour J du mois m, ramené au dernier jour si le mois est plus court (31 → 30 ou 28/29).
create function day_in_month(m text, d int) returns date
language sql immutable as $$
  select make_date(
    split_part(m, '-', 1)::int,
    split_part(m, '-', 2)::int,
    least(d, extract(day from (to_date(m || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day'))::int)
  );
$$;

-- 5. Reconduction mensuelle: enveloppes (avec groupe et lignée), revenus récurrents, dépenses récurrentes.
create or replace function rollover_month(h uuid, m text) returns int
language plpgsql security definer set search_path = public as $$
declare prev text; prev_income text; n int := 0; r record; target uuid;
begin
  if not is_member(h) then raise exception 'not a member'; end if;

  insert into month_balances (household_id, month) values (h, m) on conflict do nothing;
  if not found then return 0; end if;

  select max(month) into prev from envelopes where household_id = h and month < m;
  if prev is not null then
    insert into envelopes (household_id, month, name, kind, budget, color, icon, sort, recurring, source_id, group_id, lineage_id)
    select household_id, m, name, kind, budget, color, icon, sort, true, id, group_id, lineage_id
    from envelopes
    where household_id = h and month = prev and recurring and parent_id is null
    on conflict do nothing;
    get diagnostics n = row_count;
  end if;

  select max(month) into prev_income from incomes where household_id = h and month < m;
  if prev_income is not null then
    insert into incomes (household_id, month, label, amount, received_on, recurring, icon, color, source_id, created_by)
    select household_id, m, label, amount, day_in_month(m, extract(day from received_on)::int), true, icon, color, id, created_by
    from incomes
    where household_id = h and month = prev_income and recurring
    on conflict do nothing;
  end if;

  -- Dépenses récurrentes dues ce mois-ci (ou en retard si l'appli n'a pas été ouverte).
  for r in
    select * from recurring_expenses where household_id = h and next_month <= m for update
  loop
    select id into target from envelopes where household_id = h and month = m and lineage_id = r.lineage_id limit 1;
    if target is not null then
      insert into expenses (household_id, envelope_id, amount, note, spent_on, recurring_id, created_by)
      values (h, target, r.amount, r.note, day_in_month(m, r.day), r.id, r.created_by);
    end if;
    update recurring_expenses
    set next_month = to_char(to_date(m || '-01', 'YYYY-MM-DD') + make_interval(months => r.every_months), 'YYYY-MM')
    where id = r.id;
  end loop;

  return n;
end $$;

-- 6. Profils visibles par les membres du même foyer (prénom, nom, photo).
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  avatar_path text,
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

create function shares_household(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members a join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create policy "profils: lire ceux du foyer" on profiles for select using (id = auth.uid() or shares_household(id));
create policy "profils: créer le sien" on profiles for insert with check (id = auth.uid());
create policy "profils: modifier le sien" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Les photos des membres du foyer deviennent lisibles par les autres membres.
create policy "avatars: lire ceux du foyer" on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then shares_household(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

-- 7. Mise à jour en direct pour les nouvelles tables.
do $$
declare t text;
begin
  foreach t in array array['incomes', 'recurring_expenses', 'profiles', 'households']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
