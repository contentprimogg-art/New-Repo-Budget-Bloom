-- Remboursement d'une dépense avancée pour quelqu'un d'autre.
--   active   : compte dans l'enveloppe
--   refunded : remboursée, somme libérée (ne compte plus dans l'enveloppe)
--   kept     : remboursée, somme mise de côté pour l'épargne (compte toujours dans l'enveloppe)
alter table expenses
  add column status text not null default 'active' check (status in ('active', 'refunded', 'kept')),
  add column settled_on date;
