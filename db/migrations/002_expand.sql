-- Expansion: customers, events, payments, status tracks, turnaround, settings.
-- Additive and idempotent. Safe to run against a database that already has data.

------------------------------------------------------------------ settings
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into settings (key, value) values
  ('default_turnaround_days',      '1'::jsonb),
  ('hold_expiry_days',             '7'::jsonb),
  ('include_cancelled_in_totals',  'false'::jsonb),
  ('require_signature_for_booked', 'true'::jsonb),
  ('default_fee_treatment',        '"manager"'::jsonb)
on conflict (key) do nothing;

------------------------------------------------------------------ customers
create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  first_name  text,
  last_name   text not null,
  phone       text,
  email       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists customers_last_name_idx on customers (lower(last_name));
create index if not exists customers_phone_idx on customers (phone) where phone is not null;

-- Fixed id so re-running never creates a second Owner.
insert into customers (id, last_name, notes)
values ('00000000-0000-0000-0000-000000000001', 'Owner', 'Owner use and maintenance stays')
on conflict (id) do nothing;

------------------------------------------------------------------ events
create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  year            int not null,
  start_date      date not null,
  end_date        date not null,
  event_type      text not null default 'recurring',
  -- Flat rental rate for the whole stay. Nights do not affect price.
  suggested_rate  numeric(12,2),
  -- Derived from the flat rate over the event window. Stored so a future
  -- switch to nightly-driven pricing needs no migration.
  suggested_nightly_rate numeric(12,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_name_year_unique unique (name, year),
  constraint events_valid_window check (end_date > start_date)
);

create index if not exists events_dates_idx on events (start_date, end_date);

create table if not exists event_property_rates (
  event_id        uuid not null references events(id) on delete cascade,
  property_id     uuid not null references properties(id),
  suggested_rate  numeric(12,2) not null,
  suggested_nightly_rate numeric(12,2),
  primary key (event_id, property_id)
);

------------------------------------------------------------------ properties
alter table properties add column if not exists turnaround_days int not null default 1;

------------------------------------------------------------------ bookings
alter table bookings add column if not exists customer_id      uuid references customers(id);
alter table bookings add column if not exists event_id         uuid references events(id);
alter table bookings add column if not exists turnaround_days  int not null default 1;
alter table bookings add column if not exists lifecycle        text not null default 'active';
alter table bookings add column if not exists hold_expires_at  date;
alter table bookings add column if not exists contract_status  text not null default 'not_sent';
alter table bookings add column if not exists contract_sent_at    timestamptz;
alter table bookings add column if not exists contract_signed_at  timestamptz;
alter table bookings add column if not exists invoice_status   text not null default 'not_sent';
alter table bookings add column if not exists invoice_sent_at     timestamptz;
alter table bookings add column if not exists deposit_received_at timestamptz;
alter table bookings add column if not exists paid_in_full_at     timestamptz;
alter table bookings add column if not exists contract_ref     text;
alter table bookings add column if not exists invoice_ref      text;

do $$ begin
  alter table bookings add constraint bookings_lifecycle_check
    check (lifecycle in ('hold', 'active', 'cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table bookings add constraint bookings_contract_status_check
    check (contract_status in ('not_sent', 'sent', 'signed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table bookings add constraint bookings_invoice_status_check
    check (invoice_status in ('not_sent', 'sent', 'deposit_received', 'paid_in_full'));
exception when duplicate_object then null; end $$;

------------------------------------------------------------------ payments
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings(id) on delete cascade,
  amount      numeric(12,2) not null,
  received_at date not null default current_date,
  method      text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists payments_booking_idx on payments (booking_id);

------------------------------------------------ backfill from the old columns
-- Each existing guest_name becomes a customer, reusing a match when one exists.
do $$
declare
  r    record;
  fn   text;
  ln   text;
  cid  uuid;
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'bookings' and column_name = 'guest_name') then
    for r in select id, guest_name from bookings
             where customer_id is null and guest_name is not null and guest_name <> '' loop
      if position(' ' in r.guest_name) > 0 then
        fn := substring(r.guest_name from 1 for position(' ' in r.guest_name) - 1);
        ln := substring(r.guest_name from position(' ' in r.guest_name) + 1);
      else
        fn := null;
        ln := r.guest_name;
      end if;

      select id into cid from customers
      where coalesce(first_name, '') = coalesce(fn, '') and last_name = ln limit 1;

      if cid is null then
        insert into customers (first_name, last_name) values (fn, ln) returning id into cid;
      end if;

      update bookings set customer_id = cid where id = r.id;
    end loop;
  end if;
end $$;

-- Existing single amounts become the first payment row.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'bookings' and column_name = 'amount_received') then
    insert into payments (booking_id, amount, received_at)
    select b.id, b.amount_received, coalesce(b.paid_date, b.created_at::date)
    from bookings b
    where b.amount_received > 0
      and not exists (select 1 from payments p where p.booking_id = b.id);
  end if;
end $$;

-- Seed each booking's turnaround snapshot from its property's current setting.
update bookings b
set turnaround_days = p.turnaround_days
from properties p
where p.id = b.property_id and b.turnaround_days is distinct from p.turnaround_days;

alter table bookings alter column customer_id set not null;

alter table bookings drop column if exists guest_name;
alter table bookings drop column if exists amount_received;
alter table bookings drop column if exists paid_date;

create index if not exists bookings_window_idx    on bookings (property_id, check_in, check_out);
create index if not exists bookings_event_idx     on bookings (event_id);
create index if not exists bookings_customer_idx  on bookings (customer_id);
create index if not exists bookings_lifecycle_idx on bookings (lifecycle);
