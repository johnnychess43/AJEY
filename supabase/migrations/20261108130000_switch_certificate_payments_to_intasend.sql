alter table public.payment_orders
  drop constraint if exists payment_orders_provider_check;

alter table public.payment_orders
  alter column provider set default 'intasend';

alter table public.payment_orders
  add constraint payment_orders_provider_check
  check (provider in ('flutterwave', 'intasend'));

alter table public.payment_orders
  add column if not exists provider_invoice_id text,
  add column if not exists provider_reference text;

create unique index if not exists payment_orders_provider_invoice_id_key
  on public.payment_orders(provider_invoice_id)
  where provider_invoice_id is not null;
