-- Enveloppes récurrentes: une enveloppe « recurring » est recopiée automatiquement au premier
-- chargement de chaque nouveau mois (une seule fois par foyer et par mois).
alter table envelopes
  add column recurring boolean not null default true,
  add column source_id uuid references envelopes(id) on delete set null;

create unique index envelopes_source_month on envelopes (source_id, month) where source_id is not null;

create function rollover_month(h uuid, m text) returns int
language plpgsql security definer set search_path = public as $$
declare prev text; n int := 0;
begin
  if not is_member(h) then raise exception 'not a member'; end if;

  -- month_balances sert aussi de marqueur: le mois n'est reconduit qu'une fois,
  -- donc supprimer une enveloppe recopiée ne la fait pas revenir.
  insert into month_balances (household_id, month) values (h, m) on conflict do nothing;
  if not found then return 0; end if;

  -- Dernier mois antérieur ayant des enveloppes (même si l'appli n'a pas été ouverte un mois).
  select max(month) into prev from envelopes where household_id = h and month < m;
  if prev is null then return 0; end if;

  insert into envelopes (household_id, month, name, kind, budget, color, icon, sort, recurring, source_id)
  select household_id, m, name, kind, budget, color, icon, sort, true, id
  from envelopes
  where household_id = h and month = prev and recurring and parent_id is null
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function rollover_month(uuid, text) from public, anon;
grant execute on function rollover_month(uuid, text) to authenticated;
