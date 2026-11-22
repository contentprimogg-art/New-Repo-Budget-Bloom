// Données reprises par les sauvegardes (JSON et CSV), dans l'ordre de restauration: les références d'abord.
export const BACKUP_TABLES: { name: string; columns: string[]; conflict: string }[] = [
  { name: 'envelope_groups', columns: ['id', 'name', 'sort', 'created_at'], conflict: 'id' },
  {
    name: 'envelopes',
    columns: ['id', 'month', 'name', 'kind', 'parent_id', 'budget', 'color', 'icon', 'sort', 'recurring', 'source_id', 'group_id', 'lineage_id', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'recurring_expenses',
    columns: ['id', 'lineage_id', 'note', 'amount', 'every_months', 'day', 'next_month', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'expenses',
    columns: ['id', 'envelope_id', 'amount', 'note', 'spent_on', 'status', 'settled_on', 'recurring_id', 'original_amount', 'original_currency', 'created_at'],
    conflict: 'id',
  },
  {
    name: 'incomes',
    columns: ['id', 'month', 'label', 'amount', 'received_on', 'recurring', 'icon', 'color', 'source_id', 'created_at'],
    conflict: 'id',
  },
  { name: 'month_balances', columns: ['month', 'start_balance', 'end_balance'], conflict: 'household_id,month' },
  { name: 'savings_envelopes', columns: ['id', 'parent_id', 'name', 'target', 'sort', 'icon', 'color', 'created_at'], conflict: 'id' },
  { name: 'savings_milestones', columns: ['id', 'savings_id', 'amount'], conflict: 'id' },
  {
    name: 'savings_entries',
    columns: ['id', 'savings_id', 'amount', 'note', 'entry_date', 'source_expense_id', 'transfer_id', 'from_budget', 'created_at'],
    conflict: 'id',
  },
]
