create extension if not exists "pgcrypto";
create sequence if not exists public.registros_folio_seq start 1;

create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  num text not null,
  nombre text not null,
  departamento text not null,
  turno text not null,
  fecha_ingreso date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, num)
);

create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folio text not null default lpad(nextval('public.registros_folio_seq')::text, 7, '0'),
  num_emp text not null,
  empleado text not null,
  departamento text not null,
  turno text not null,
  fecha_ingreso date not null,
  antiguedad text not null,
  dias_aplican text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  dias_disponibles integer not null,
  dias_tomados integer not null,
  fecha_regreso date not null,
  dias_pendientes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, folio)
);

alter table public.registros
alter column folio set default lpad(nextval('public.registros_folio_seq')::text, 7, '0');

revoke all on public.empleados from anon;
revoke all on public.registros from anon;
grant select, insert, update, delete on public.empleados to authenticated;
grant select, insert, update, delete on public.registros to authenticated;
grant usage, select on sequence public.registros_folio_seq to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists empleados_set_updated_at on public.empleados;
create trigger empleados_set_updated_at
before update on public.empleados
for each row execute function public.set_updated_at();

drop trigger if exists registros_set_updated_at on public.registros;
create trigger registros_set_updated_at
before update on public.registros
for each row execute function public.set_updated_at();

alter table public.empleados enable row level security;
alter table public.registros enable row level security;

drop policy if exists "empleados_select_own" on public.empleados;
create policy "empleados_select_own"
on public.empleados for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "empleados_insert_own" on public.empleados;
create policy "empleados_insert_own"
on public.empleados for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "empleados_update_own" on public.empleados;
create policy "empleados_update_own"
on public.empleados for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "empleados_delete_own" on public.empleados;
create policy "empleados_delete_own"
on public.empleados for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "registros_select_own" on public.registros;
create policy "registros_select_own"
on public.registros for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "registros_insert_own" on public.registros;
create policy "registros_insert_own"
on public.registros for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "registros_update_own" on public.registros;
create policy "registros_update_own"
on public.registros for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "registros_delete_own" on public.registros;
create policy "registros_delete_own"
on public.registros for delete
to authenticated
using (auth.uid() = user_id);
