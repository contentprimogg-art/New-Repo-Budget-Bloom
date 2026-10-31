-- Conversion de devises.

-- 1. Dépense saisie dans une autre devise (voyage…): le montant est converti dans la devise du foyer,
--    le montant et la devise d'origine sont gardés pour l'affichage.
alter table expenses
  add column original_amount numeric(12,2),
  add column original_currency text check (original_currency ~ '^[A-Z]{3}$');

-- 2. Changement de devise du foyer avec conversion de tous les montants, en une seule transaction
--    (tout est converti, ou rien en cas d'erreur).
create function convert_household(h uuid, rate numeric, new_currency text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(h) then raise exception 'not a member'; end if;
  if rate is null or rate <= 0 then raise exception 'invalid rate'; end if;
  if new_currency !~ '^[A-Z]{3}$' then raise exception 'invalid currency'; end if;

  update envelopes set budget = round(budget * rate, 2) where household_id = h;
  update expenses set amount = greatest(round(amount * rate, 2), 0.01) where household_id = h;
  update incomes set amount = greatest(round(amount * rate, 2), 0.01) where household_id = h;
  update recurring_expenses set amount = greatest(round(amount * rate, 2), 0.01) where household_id = h;
  update month_balances
    set start_balance = round(start_balance * rate, 2), end_balance = round(end_balance * rate, 2)
    where household_id = h;
  update savings_envelopes set target = greatest(round(target * rate, 2), 0.01) where household_id = h and target is not null;
  update savings_milestones set amount = greatest(round(amount * rate, 2), 0.01) where household_id = h;
  update savings_entries
    set amount = case when amount > 0 then greatest(round(amount * rate, 2), 0.01) else least(round(amount * rate, 2), -0.01) end
    where household_id = h;
  update households set currency = new_currency where id = h;
end $$;

revoke all on function convert_household(uuid, numeric, text) from public, anon;
grant execute on function convert_household(uuid, numeric, text) to authenticated;
