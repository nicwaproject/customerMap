begin;

-- No customer values or table columns are changed.
create index if not exists pelanggan_reading_day_meter_reader_idx
  on public.pelanggan ((extract(day from tanggal_baca)::integer), pembaca_meter);

create or replace function public.get_customers_by_reading_day(
  p_day integer,
  p_meter_reader text default null
)
returns setof public.pelanggan
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.pelanggan as p
  where p_day between 1 and 31
    and extract(day from p.tanggal_baca)::integer = p_day
    and (p_meter_reader is null or p.pembaca_meter = p_meter_reader);
$$;

-- Preserve the caller's existing table privileges and row-level security.
revoke execute on function public.get_customers_by_reading_day(integer, text) from public, anon;
grant execute on function public.get_customers_by_reading_day(integer, text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
