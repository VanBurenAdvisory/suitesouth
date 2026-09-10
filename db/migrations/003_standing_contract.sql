-- Returning guests are covered by a standing agreement rather than signing a
-- new contract per stay. Recording that as "signed" would assert a signature
-- that never happened, so the contract track gains a distinct value for it.

alter table customers
  add column if not exists has_standing_contract boolean not null default false;

alter table bookings drop constraint if exists bookings_contract_status_check;

alter table bookings add constraint bookings_contract_status_check
  check (contract_status in ('not_sent', 'sent', 'signed', 'standing'));
