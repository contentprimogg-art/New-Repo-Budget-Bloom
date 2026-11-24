-- Préparer un mois à l'avance: ses enveloppes et revenus récurrents sont créés tout de suite,
-- pour pouvoir les modifier ou y noter des dépenses avant son arrivée.
-- Les dépenses récurrentes, elles, restent ajoutées à l'arrivée du mois (une seule fois).

alter table month_balances add column prepared boolean not null default false;
update month_balances set prepared = true where rolled_over;

-- Copie (une seule fois par mois) des enveloppes et revenus récurrents du dernier mois existant.
-- Une enveloppe supprimée d'un mois préparé n'y revient donc jamais.
create or replace function prepare_month(h uuid, m text) returns int
language plpgsql security definer set search_path = public as $$
declare prev text; prev_income text; n int := 0;
begin
  if not is_member(h) then raise exception 'not a member'; end if;

  insert into month_balances (household_id, month) values (h, m) on conflict do nothing;
  update month_balances set prepared = true where household_id = h and month = m and not prepared;
  if not found then return 0; end if;

  select max(month) into prev from envelopes where household_id = h and month < m;
  if prev is not null then
    insert into envelopes (household_id, month, name, kind, budget, color, icon, sort, recurring, source_id, group_id, lineage_id)
    select e.household_id, m, e.name, e.kind, e.budget, e.color, e.icon, e.sort, true, e.id, e.group_id, e.lineage_id
    from envelopes e
    where e.household_id = h and e.month = prev and e.recurring and e.parent_id is null
      and not exists (select 1 from envelopes x where x.household_id = h and x.month = m and x.lineage_id = e.lineage_id)
    on conflict do nothing;
    get diagnostics n = row_count;
  end if;

  select max(month) into prev_income from incomes where household_id = h and month < m;
  if prev_income is not null then
    insert into incomes (household_id, month, label, amount, received_on, recurring, icon, color, source_id, created_by)
    select i.household_id, m, i.label, i.amount, day_in_month(m, extract(day from i.received_on)::int), true, i.icon, i.color, i.id, i.created_by
    from incomes i
    where i.household_id = h and i.month = prev_income and i.recurring
      and not exists (select 1 from incomes x where x.household_id = h and x.month = m and lower(x.label) = lower(i.label))
    on conflict do nothing;
  end if;

  return n;
end $$;

revoke all on function prepare_month(uuid, text) from public, anon;
grant execute on function prepare_month(uuid, text) to authenticated;

-- Arrivée du mois: préparation si elle n'a pas déjà été faite, puis dépenses récurrentes dues.
create or replace function rollover_month(h uuid, m text) returns int
language plpgsql security definer set search_path = public as $$
declare n int; r record; target uuid;
begin
  if not is_member(h) then raise exception 'not a member'; end if;

  insert into month_balances (household_id, month) values (h, m) on conflict do nothing;
  update month_balances set rolled_over = true where household_id = h and month = m and not rolled_over;
  if not found then return 0; end if;

  n := prepare_month(h, m);

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
