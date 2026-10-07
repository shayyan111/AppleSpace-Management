-- Apply after database/batch-v6-sold-phone-archive.sql on an existing AppleSpace database.
-- Operational history cleanup only: ledger entries, audit, contacts and active stock stay intact.
create table if not exists private.erp_cleanup_requests (
 request_id uuid primary key, actor uuid not null, payload jsonb not null,
 result jsonb not null, created_at timestamptz not null default now()
);
alter table private.erp_cleanup_requests enable row level security;
revoke all on private.erp_cleanup_requests from public,anon,authenticated;

create or replace function private.erp_cleanup_day(value timestamptz) returns date
language sql immutable strict set search_path='' as $$select (value at time zone 'Asia/Karachi')::date$$;

create or replace function private.erp_cleanup_validate(date_from date,date_to date) returns void
language plpgsql set search_path='' as $$
declare cutoff date:=date_trunc('year',now() at time zone 'Asia/Karachi')::date;
begin
 if auth.uid() is null or private.current_app_role()::text is distinct from 'owner' then
  raise exception 'Owner access required';
 end if;
 if date_from is null or date_to is null or not isfinite(date_from) or not isfinite(date_to) or date_from>date_to then
  raise exception 'Choose a valid start date on or before the end date';
 end if;
 if date_to>=cutoff then raise exception 'Records from the current year or future years cannot be deleted'; end if;
end $$;

-- A single statement builds the preview from a consistent snapshot. Child business dates
-- must also be in the requested range. Creation dates protect newly entered/backdated details.
create or replace function private.erp_cleanup_plan(date_from date,date_to date) returns jsonb
language sql stable set search_path='' as $$
with cutoff as (select date_trunc('year',now() at time zone 'Asia/Karachi')::date as day),
old_sales as (
 select s.id from public.sales s,cutoff c
 where private.erp_cleanup_day(s.sale_date) between date_from and date_to
 and private.erp_cleanup_day(s.created_at)<c.day
 and coalesce((select sum(p.amount) from public.payments p where p.sale_id=s.id),0)>=s.final_total
 and not exists(select 1 from public.payments p where p.sale_id=s.id and
   (private.erp_cleanup_day(p.payment_date) not between date_from and date_to or private.erp_cleanup_day(p.created_at)>=c.day))
 and not exists(select 1 from public.sale_items i left join public.sale_item_costs k on k.sale_item_id=i.id where i.sale_id=s.id and
   (private.erp_cleanup_day(i.created_at)>=c.day or private.erp_cleanup_day(k.created_at)>=c.day))
 and not exists(select 1 from public.sold_phones a where a.sale_id=s.id and private.erp_cleanup_day(a.sold_at) not between date_from and date_to)
 and not exists(select 1 from public.sale_items si join public.inventory_items i on i.id=si.inventory_item_id where si.sale_id=s.id and
   (i.status<>'sold' or i.sold_at is null or private.erp_cleanup_day(i.sold_at) not between date_from and date_to))
 and not exists(select 1 from public.stock_movements m where m.reference_id=s.id and private.erp_cleanup_day(m.created_at) not between date_from and date_to)
),
old_archives as (
 select a.id from public.sold_phones a where a.sale_id in(select id from old_sales)
 and private.erp_cleanup_day(a.sold_at) between date_from and date_to
),
old_expenses as (
 select e.id from public.expenses e where private.erp_cleanup_day(e.expense_date) between date_from and date_to
),
settled_purchases as (
 select p.id from public.purchases p,cutoff c
 where private.erp_cleanup_day(p.purchase_date) between date_from and date_to
 and private.erp_cleanup_day(p.created_at)<c.day
 and coalesce((select sum(s.amount) from public.supplier_payments s where s.purchase_id=p.id),0)>=p.total_amount
 and not exists(select 1 from public.supplier_payments s where s.purchase_id=p.id and private.erp_cleanup_day(s.payment_date) not between date_from and date_to)
),
old_inventory as (
 select i.id from public.inventory_items i where i.status='sold'
 and (i.purchase_id is null or i.purchase_id in(select id from settled_purchases))
 and private.erp_cleanup_day(i.created_at) between date_from and date_to
 and private.erp_cleanup_day(i.sold_at) between date_from and date_to
 and not exists(select 1 from public.sale_items s where s.inventory_item_id=i.id and s.sale_id not in(select id from old_sales))
 and not exists(select 1 from public.sold_phones a where a.original_inventory_id=i.id and a.id not in(select id from old_archives))
 and not exists(select 1 from public.expenses e where e.inventory_item_id=i.id and e.id not in(select id from old_expenses))
 and not exists(select 1 from public.stock_movements m where m.inventory_item_id=i.id and private.erp_cleanup_day(m.created_at) not between date_from and date_to)
 and not exists(select 1 from public.product_images p where p.inventory_item_id=i.id and private.erp_cleanup_day(p.created_at) not between date_from and date_to)
 and not exists(select 1 from public.website_catalog w where w.inventory_item_id=i.id)
),
old_purchases as (
 select p.id from public.purchases p where p.id in(select id from settled_purchases)
 and not exists(select 1 from public.inventory_items i where i.purchase_id=p.id and i.id not in(select id from old_inventory))
 and not exists(select 1 from public.accessories a where a.purchase_id=p.id)
 and not exists(select 1 from public.stock_movements m where m.reference_id=p.id and private.erp_cleanup_day(m.created_at) not between date_from and date_to)
),
old_sessions as (
 select s.id from public.daily_sessions s where s.business_date between date_from and date_to
 and s.closed_at is not null and private.erp_cleanup_day(s.opened_at) between date_from and date_to
 and private.erp_cleanup_day(s.closed_at) between date_from and date_to
), ids as (
 select jsonb_build_object(
 'sales',coalesce((select jsonb_agg(id order by id) from old_sales),'[]'),
 'payments',coalesce((select jsonb_agg(id order by id) from public.payments where sale_id in(select id from old_sales)),'[]'),
 'sale_items',coalesce((select jsonb_agg(id order by id) from public.sale_items where sale_id in(select id from old_sales)),'[]'),
 'sale_item_costs',coalesce((select jsonb_agg(sale_item_id order by sale_item_id) from public.sale_item_costs where sale_item_id in(select id from public.sale_items where sale_id in(select id from old_sales))),'[]'),
 'purchases',coalesce((select jsonb_agg(id order by id) from old_purchases),'[]'),
 'supplier_payments',coalesce((select jsonb_agg(id order by id) from public.supplier_payments where purchase_id in(select id from old_purchases)),'[]'),
 'sold_phones',coalesce((select jsonb_agg(id order by id) from old_archives),'[]'),
 'inventory_items',coalesce((select jsonb_agg(id order by id) from old_inventory),'[]'),
 'expenses',coalesce((select jsonb_agg(id order by id) from old_expenses),'[]'),
 'daily_sessions',coalesce((select jsonb_agg(id order by id) from old_sessions),'[]'),
 'stock_movements',coalesce((select jsonb_agg(id order by id) from public.stock_movements where inventory_item_id in(select id from old_inventory)),'[]'),
 'product_images',coalesce((select jsonb_agg(id order by id) from public.product_images where inventory_item_id in(select id from old_inventory)),'[]')
 ) as value
), protected as (
 select jsonb_build_object(
 'sales',(select count(*) from public.sales where private.erp_cleanup_day(sale_date) between date_from and date_to)-(select count(*) from old_sales),
 'purchases',(select count(*) from public.purchases where private.erp_cleanup_day(purchase_date) between date_from and date_to)-(select count(*) from old_purchases),
 'sold_phones',(select count(*) from public.sold_phones where private.erp_cleanup_day(sold_at) between date_from and date_to)-(select count(*) from old_archives),
 'inventory_items',(select count(*) from public.inventory_items where private.erp_cleanup_day(created_at) between date_from and date_to)-(select count(*) from old_inventory),
 'daily_sessions',(select count(*) from public.daily_sessions where business_date between date_from and date_to)-(select count(*) from old_sessions)
 ) as value
)
select jsonb_build_object('from',date_from,'to',date_to,'maximum',(select day-1 from cutoff),'ids',ids.value,
 'counts',(select jsonb_object_agg(key,jsonb_array_length(value)) from jsonb_each(ids.value)),
 'total',(select sum(jsonb_array_length(value)) from jsonb_each(ids.value)),
 'protected',protected.value,'token',md5(date_from::text||':'||date_to::text||':'||ids.value::text)) from ids,protected;
$$;

create or replace function private.erp_cleanup_preview(date_from date,date_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.erp_cleanup_validate(date_from,date_to);
 return private.erp_cleanup_plan(date_from,date_to)-'ids';
end $$;

create or replace function private.erp_cleanup_delete(date_from date,date_to date,preview_token text,confirmation text,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan jsonb; previous private.erp_cleanup_requests%rowtype; payload jsonb; result jsonb;
 ids uuid[]; table_name text; snapshot jsonb:='{}'; backup_id uuid;
begin
 perform private.erp_cleanup_validate(date_from,date_to);
 if request_id is null then raise exception 'A cleanup request ID is required'; end if;
 if confirmation is distinct from ('DELETE '||date_from::text||' TO '||date_to::text) then raise exception 'Type the exact deletion confirmation'; end if;
 payload:=jsonb_build_object('from',date_from,'to',date_to,'token',preview_token);
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into previous from private.erp_cleanup_requests r where r.request_id=erp_cleanup_delete.request_id;
 if found then
  if previous.actor<>auth.uid() or previous.payload<>payload then raise exception 'Cleanup request ID already used'; end if;
  return previous.result;
 end if;
 -- Block writes while recalculating eligibility and deleting; any failure rolls back everything.
 perform set_config('lock_timeout','5s',true);
 lock table public.user_profiles,public.purchases,public.sales,public.payments,public.supplier_payments,
 public.sale_items,public.sale_item_costs,public.inventory_items,public.sold_phones,public.accessories,
 public.expenses,public.daily_sessions,public.stock_movements,public.product_images,public.website_catalog,
 public.website_catalog_images in share row exclusive mode;
 perform private.erp_cleanup_validate(date_from,date_to);
 plan:=private.erp_cleanup_plan(date_from,date_to);
 if preview_token is distinct from plan->>'token' then raise exception 'Records changed. Preview the date range again before deleting'; end if;
 if (plan->>'total')::bigint=0 then raise exception 'No eligible old records to delete'; end if;
 -- Snapshot first, without pruning other snapshots as a side effect of cleanup.
 foreach table_name in array array['user_profiles','sellers','customers','purchases','inventory_items','sales','sale_items','payments','sale_item_costs','supplier_payments','expenses','daily_sessions','erp_accounts','erp_journals','erp_journal_lines','erp_audit','product_images','stock_movements','accessories','sold_phones'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',table_name) into result;
  snapshot:=snapshot||jsonb_build_object(table_name,result);
 end loop;
 insert into public.erp_backups(data) values(snapshot) returning id into backup_id;
 -- Explicit FK-safe order. Cascades only remove children already included in the preview.
 foreach table_name in array array['expenses','sold_phones','payments','sale_item_costs','sale_items','sales','stock_movements','product_images','inventory_items','supplier_payments','purchases','daily_sessions'] loop
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(plan->'ids'->table_name);
  if table_name='sale_item_costs' then delete from public.sale_item_costs where sale_item_id=any(ids);
  else execute format('delete from public.%I where id=any($1)',table_name) using ids; end if;
 end loop;
 result:=(plan-'ids'-'token'-'protected')||jsonb_build_object('backup_id',backup_id);
 insert into public.erp_audit(actor,action,record_id,details) values(auth.uid(),'record_cleanup',request_id,result);
 insert into private.erp_cleanup_requests(request_id,actor,payload,result) values(request_id,auth.uid(),payload,result);
 return result;
end $$;

create or replace function public.erp_cleanup_preview(date_from date,date_to date) returns jsonb
language sql security invoker set search_path='' as $$select private.erp_cleanup_preview(date_from,date_to)$$;
create or replace function public.erp_cleanup_delete(date_from date,date_to date,preview_token text,confirmation text,request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.erp_cleanup_delete(date_from,date_to,preview_token,confirmation,request_id)$$;
revoke all on function private.erp_cleanup_day(timestamptz),private.erp_cleanup_validate(date,date),private.erp_cleanup_plan(date,date),
 private.erp_cleanup_preview(date,date),private.erp_cleanup_delete(date,date,text,text,uuid),
 public.erp_cleanup_preview(date,date),public.erp_cleanup_delete(date,date,text,text,uuid) from public,anon,authenticated;
grant execute on function private.erp_cleanup_preview(date,date),private.erp_cleanup_delete(date,date,text,text,uuid),
 public.erp_cleanup_preview(date,date),public.erp_cleanup_delete(date,date,text,text,uuid) to authenticated;
notify pgrst,'reload schema';
