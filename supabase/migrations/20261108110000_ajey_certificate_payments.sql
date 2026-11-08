create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_slug text not null,
  currency text not null check (currency in ('KES','USD')),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','successful','failed')),
  provider text not null default 'flutterwave' check (provider = 'flutterwave'),
  tx_ref text not null unique,
  flutterwave_transaction_id text unique,
  payment_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_order_id uuid not null unique references public.payment_orders(id),
  course_slug text not null,
  certificate_number text not null unique,
  issued_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;
alter table public.certificates enable row level security;
revoke all on public.payment_orders from anon, authenticated;
revoke all on public.certificates from anon, authenticated;
grant select on public.payment_orders to authenticated;
grant select on public.certificates to authenticated;
grant all on public.payment_orders to service_role;
grant all on public.certificates to service_role;

drop policy if exists "Users can view their own payment orders" on public.payment_orders;
create policy "Users can view their own payment orders"
on public.payment_orders for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own certificates" on public.certificates;
create policy "Users can view their own certificates"
on public.certificates for select to authenticated
using ((select auth.uid()) = user_id);

create index if not exists payment_orders_user_created_idx
on public.payment_orders(user_id, created_at desc);
create index if not exists certificates_user_issued_idx
on public.certificates(user_id, issued_at desc);
