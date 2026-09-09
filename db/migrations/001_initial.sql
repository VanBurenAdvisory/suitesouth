-- Booking log schema. Plain Postgres, no vendor-specific extensions.
-- Safe to re-run: creates only what is missing, seeds properties idempotently.

create table if not exists properties (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  owner_share_pct     numeric(6,3) not null,
  commission_pct      numeric(6,3) not null,
  fee_treatment       text not null default 'manager',
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  constraint properties_fee_treatment_check
    check (fee_treatment in ('manager', 'owner', 'commissionable'))
);

create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references properties(id),
  guest_name          text not null,
  check_in            date not null,
  check_out           date not null,
  -- Derived from the entered stay total. Stored for display; nothing is
  -- calculated from it, so a rounded nightly figure can never skew a payout.
  nightly_rate        numeric(12,2) not null,
  nights              int not null,
  fees                numeric(12,2) not null default 0,
  subtotal            numeric(12,2) not null,

  -- Rate terms are SNAPSHOT here at insert time. Every derived figure below is
  -- computed from these three columns, never from a live join to properties, so
  -- changing a property's rates later cannot alter historical bookings.
  owner_share_pct     numeric(6,3) not null,
  commission_pct      numeric(6,3) not null,
  fee_treatment       text not null default 'manager',

  manager_commission  numeric(12,2) not null,
  owner_due           numeric(12,2) not null,
  coowner_due         numeric(12,2) not null default 0,
  tax_amount          numeric(12,2),
  amount_due          numeric(12,2) not null,
  amount_received     numeric(12,2) not null default 0,
  paid_date           date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint valid_stay check (check_out > check_in),
  constraint valid_nights check (nights > 0),
  constraint bookings_fee_treatment_check
    check (fee_treatment in ('manager', 'owner', 'commissionable'))
);

create index if not exists bookings_check_in_idx on bookings (check_in desc);
create index if not exists bookings_property_idx on bookings (property_id);

-- Placeholder rate terms. The real owner share and commission percentages are
-- deployment specific and are set directly in the database after seeding, so
-- they are never committed. Changing them later cannot affect existing
-- bookings, which each carry their own snapshot of the terms.
insert into properties (name, owner_share_pct, commission_pct, fee_treatment, sort_order)
values
  ('The Stacy',    100, 50, 'manager', 1),
  ('The Kerry',    100, 50, 'manager', 2),
  ('The Cocktail',  80, 50, 'manager', 3)
on conflict (name) do nothing;
