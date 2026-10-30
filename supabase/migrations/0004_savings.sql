-- Épargne: enveloppes (avec sous-enveloppes sur un seul niveau), paliers et mouvements.
-- Contrairement aux enveloppes de dépenses, l'épargne ne dépend pas du mois: le solde s'accumule.
--
-- Total d'une enveloppe mère = son solde « non réparti » (ses propres mouvements)
--                            + la somme des soldes de ses sous-enveloppes.

create table savings_envelopes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  parent_id uuid,
  name text not null,
  target numeric(12,2) check (target is null or target > 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, household_id),
  check (parent_id is null or parent_id <> id)
);
-- Clé étrangère composite: une sous-enveloppe est forcément dans le même foyer que sa mère.
alter table savings_envelopes
  add foreign key (parent_id, household_id) references savings_envelopes (id, household_id) on delete cascade;

create function savings_one_level() returns trigger
language plpgsql as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from savings_envelopes p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'savings sub-envelopes cannot be nested';
    end if;
    if exists (select 1 from savings_envelopes c where c.parent_id = new.id) then
      raise exception 'an envelope with sub-envelopes cannot become a sub-envelope';
    end if;
  end if;
  return new;
end $$;

create trigger savings_one_level
  before insert or update of parent_id on savings_envelopes
  for each row execute function savings_one_level();

create table savings_milestones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  savings_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  unique (savings_id, amount),
  foreign key (savings_id, household_id) references savings_envelopes (id, household_id) on delete cascade
);

-- Mouvements: montant positif = dépôt, négatif = retrait.
-- transfer_id relie les deux écritures d'un virement interne; source_expense_id relie
-- une écriture à la dépense remboursée « mise de côté ».
create table savings_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  savings_id uuid not null,
  amount numeric(12,2) not null check (amount <> 0),
  note text,
  entry_date date not null default current_date,
  source_expense_id uuid,
  transfer_id uuid,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (savings_id, household_id) references savings_envelopes (id, household_id) on delete cascade
);
create index on savings_entries (savings_id);
create index on savings_entries (transfer_id) where transfer_id is not null;
create unique index savings_entries_source_expense on savings_entries (source_expense_id) where source_expense_id is not null;

alter table savings_envelopes enable row level security;
alter table savings_milestones enable row level security;
alter table savings_entries enable row level security;

create policy "membres: savings_envelopes" on savings_envelopes for all
  using (is_member(household_id)) with check (is_member(household_id));
create policy "membres: savings_milestones" on savings_milestones for all
  using (is_member(household_id)) with check (is_member(household_id));
create policy "membres: savings_entries" on savings_entries for all
  using (is_member(household_id)) with check (is_member(household_id));
