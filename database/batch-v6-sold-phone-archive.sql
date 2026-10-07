-- Batch V6: sold-phone archive + IMEI reuse after sale.
-- Run AFTER batch-v5-workflow-upgrade.sql.
-- This is the same migration successfully applied to the connected AppleSpace Supabase project.

create table if not exists public.sold_phones (
  id uuid primary key default gen_random_uuid(),
  original_inventory_id uuid not null unique,
  sale_id uuid null references public.sales(id) on delete set null,
  stock_code text,
  barcode_value text,
  model text not null,
  storage text,
  color text,
  imei_1 text,
  imei_2 text,
  serial_number text,
  battery_health smallint,
  pta_status text,
  purchase_price numeric,
  sale_price numeric,
  condition_grade text,
  warranty_notes text,
  sold_at timestamptz not null default now(),
  archived_at timestamptz not null default now()
);

-- Legacy/test rows may contain non-15-digit identifiers; preserve history as-is.
alter table public.sold_phones drop constraint if exists sold_phones_imei_1_format;
alter table public.sold_phones drop constraint if exists sold_phones_imei_2_format;

create index if not exists sold_phones_imei1_idx on public.sold_phones(imei_1);
create index if not exists sold_phones_imei2_idx on public.sold_phones(imei_2);
create index if not exists sold_phones_sold_at_idx on public.sold_phones(sold_at desc);

-- Copy existing sold phones into the dedicated sold-phone archive.
insert into public.sold_phones(
  original_inventory_id,sale_id,stock_code,barcode_value,model,storage,color,
  imei_1,imei_2,serial_number,battery_health,pta_status,purchase_price,sale_price,
  condition_grade,warranty_notes,sold_at
)
select
  i.id,
  (select si.sale_id from public.sale_items si where si.inventory_item_id=i.id limit 1),
  i.stock_code,i.barcode_value,i.model,i.storage,i.color,
  i.imei_1,i.imei_2,i.serial_number,i.battery_health,i.pta_status::text,
  i.purchase_price,(select si.final_price from public.sale_items si where si.inventory_item_id=i.id limit 1),i.condition_grade,i.warranty_notes,
  coalesce(i.sold_at,now())
from public.inventory_items i
where i.status='sold'
on conflict (original_inventory_id) do update set
  sale_id=excluded.sale_id,
  stock_code=excluded.stock_code,
  barcode_value=excluded.barcode_value,
  model=excluded.model,
  storage=excluded.storage,
  color=excluded.color,
  imei_1=excluded.imei_1,
  imei_2=excluded.imei_2,
  serial_number=excluded.serial_number,
  battery_health=excluded.battery_health,
  pta_status=excluded.pta_status,
  purchase_price=excluded.purchase_price,
  sale_price=excluded.sale_price,
  condition_grade=excluded.condition_grade,
  warranty_notes=excluded.warranty_notes,
  sold_at=excluded.sold_at,
  archived_at=now();

-- Old global unique constraints caused a previously sold IMEI to block a buy-back.
-- Replace them with uniqueness only across ACTIVE inventory statuses.
alter table public.inventory_items drop constraint if exists inventory_items_imei_1_key;
alter table public.inventory_items drop constraint if exists inventory_items_imei_2_key;

drop index if exists public.inventory_active_imei_1_key;
drop index if exists public.inventory_active_imei_2_key;

create unique index inventory_active_imei_1_key
  on public.inventory_items(imei_1)
  where status in ('in_stock','reserved','returned','repair') and imei_1 is not null;

create unique index inventory_active_imei_2_key
  on public.inventory_items(imei_2)
  where status in ('in_stock','reserved','returned','repair') and imei_2 is not null;

-- Sold stock must not remain publicly sellable.
update public.inventory_items
set show_on_website=false, website_price=null
where status='sold'
  and (show_on_website is true or website_price is not null);

-- Archive every phone automatically when its status changes to sold.
create or replace function private.archive_sold_phone() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_sale uuid;
begin
  if new.status='sold' and old.status<>'sold' then
    select si.sale_id into v_sale
    from public.sale_items si
    where si.inventory_item_id=old.id
    limit 1;

    insert into public.sold_phones(
      original_inventory_id,sale_id,stock_code,barcode_value,model,storage,color,
      imei_1,imei_2,serial_number,battery_health,pta_status,purchase_price,sale_price,
      condition_grade,warranty_notes,sold_at
    ) values (
      old.id,v_sale,old.stock_code,old.barcode_value,old.model,old.storage,old.color,
      old.imei_1,old.imei_2,old.serial_number,old.battery_health,old.pta_status::text,
      old.purchase_price,(select si.final_price from public.sale_items si where si.inventory_item_id=old.id and si.sale_id=v_sale limit 1),old.condition_grade,old.warranty_notes,
      coalesce(new.sold_at,now())
    ) on conflict (original_inventory_id) do update set
      sale_id=excluded.sale_id,
      stock_code=excluded.stock_code,
      barcode_value=excluded.barcode_value,
      model=excluded.model,
      storage=excluded.storage,
      color=excluded.color,
      imei_1=excluded.imei_1,
      imei_2=excluded.imei_2,
      serial_number=excluded.serial_number,
      battery_health=excluded.battery_health,
      pta_status=excluded.pta_status,
      purchase_price=excluded.purchase_price,
      sale_price=excluded.sale_price,
      condition_grade=excluded.condition_grade,
      warranty_notes=excluded.warranty_notes,
      sold_at=excluded.sold_at,
      archived_at=now();

    new.show_on_website:=false;
    new.website_price:=null;
  end if;
  return new;
end $$;

drop trigger if exists trg_archive_sold_phone on public.inventory_items;
create trigger trg_archive_sold_phone
before update on public.inventory_items
for each row execute function private.archive_sold_phone();

-- Read-only RPC for the Sold Phones screen.
create or replace function private.erp_sold_phones() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r text;
begin
  r:=private.current_app_role()::text;
  if auth.uid() is null or r is null then
    raise exception 'Active staff account required';
  end if;

  return coalesce((
    select jsonb_agg(
      case when r='salesperson'
        then to_jsonb(s)-'purchase_price'
        else to_jsonb(s)
      end
      order by s.sold_at desc
    )
    from public.sold_phones s
  ),'[]'::jsonb);
end $$;

revoke all on function private.erp_sold_phones() from public,anon,authenticated;
grant execute on function private.erp_sold_phones() to authenticated;
create or replace function public.erp_sold_phones() returns jsonb
language sql stable security invoker set search_path='' as $$ select private.erp_sold_phones(); $$;
revoke all on function public.erp_sold_phones() from public,anon,authenticated;
grant execute on function public.erp_sold_phones() to authenticated;

alter table public.sold_phones enable row level security;
revoke all on public.sold_phones from anon, authenticated;

revoke all on function private.archive_sold_phone() from public,anon,authenticated;

-- Preserve sold-phone archives in manual and scheduled snapshots.
create or replace function private.erp_backup() returns uuid language plpgsql security definer set search_path='' as $$
declare d jsonb:='{}'; t text; v uuid; x jsonb; begin
 foreach t in array array['user_profiles','sellers','customers','purchases','inventory_items','sales','sale_items','payments','sale_item_costs','supplier_payments','expenses','daily_sessions','erp_accounts','erp_journals','erp_journal_lines','erp_audit','product_images','stock_movements','accessories','sold_phones'] loop
 execute format('select coalesce(jsonb_agg(t),''[]''::jsonb) from public.%I t',t) into x;
 d:=d||jsonb_build_object(t,x);
 end loop;
 insert into public.erp_backups(data) values(d) returning id into v;
 delete from public.erp_backups where created_at<now()-interval '30 days';
 return v;
end $$;
revoke all on function private.erp_backup() from public,anon,authenticated;
