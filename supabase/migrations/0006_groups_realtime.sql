-- Groupes d'enveloppes (ex. « Dépenses variables »), icônes de l'épargne et mise à jour en direct.

-- 1. Groupes: ils ne dépendent pas du mois, les enveloppes reconduites gardent leur groupe.
create table envelope_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on envelope_groups (household_id);

alter table envelope_groups enable row level security;
create policy "membres: envelope_groups" on envelope_groups for all
  using (is_member(household_id)) with check (is_member(household_id));

-- Supprimer un groupe ne supprime pas ses enveloppes: elles deviennent « sans groupe ».
alter table envelopes add column group_id uuid references envelope_groups(id) on delete set null;

-- La reconduction mensuelle conserve aussi le groupe.
create or replace function rollover_month(h uuid, m text) returns int
language plpgsql security definer set search_path = public as $$
declare prev text; n int := 0;
begin
  if not is_member(h) then raise exception 'not a member'; end if;

  insert into month_balances (household_id, month) values (h, m) on conflict do nothing;
  if not found then return 0; end if;

  select max(month) into prev from envelopes where household_id = h and month < m;
  if prev is null then return 0; end if;

  insert into envelopes (household_id, month, name, kind, budget, color, icon, sort, recurring, source_id, group_id)
  select household_id, m, name, kind, budget, color, icon, sort, true, id, group_id
  from envelopes
  where household_id = h and month = prev and recurring and parent_id is null
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- 2. Icône et couleur des enveloppes d'épargne (comme les enveloppes de dépenses).
alter table savings_envelopes add column icon text, add column color text;

-- 3. Mise à jour en direct: les changements sont diffusés aux autres appareils du foyer
--    (la sécurité par ligne s'applique: chacun ne reçoit que les données de son foyer).
do $$
declare t text;
begin
  foreach t in array array['envelopes', 'expenses', 'month_balances', 'envelope_groups',
                           'savings_envelopes', 'savings_milestones', 'savings_entries']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
