-- Incremental upgrade after V5/V6 and supplier_optional_details.
-- Adds ledgers, owner locks, backend invoice profit, and required phone purchase details.
create table public.erp_ledger_entries (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('receivable','payable')),
 full_name text not null check(length(trim(full_name)) between 1 and 200),
 mobile text, category text not null, description text not null check(length(trim(description)) between 1 and 1000),
 reference text, amount numeric(14,2) not null check(amount>0), record_date date not null,
 due_date date, notes text, created_by uuid references public.user_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 check(due_date is null or due_date>=record_date),
 check((kind='receivable' and category in ('existing_balance','money_advance','service_income')) or
       (kind='payable' and category in ('existing_balance','money_borrowed','expense_owed')))
);
create table public.erp_ledger_payments (
 id uuid primary key default gen_random_uuid(),entry_id uuid not null references public.erp_ledger_entries(id),
 amount numeric(14,2) not null check(amount>0),method public.payment_method not null,
 payment_date timestamptz not null default now(),notes text,
 created_by uuid references public.user_profiles(id) on delete set null
);
create index erp_ledger_entries_kind_date_idx on public.erp_ledger_entries(kind,record_date desc);
create index erp_ledger_entries_creator_idx on public.erp_ledger_entries(created_by);
create index erp_ledger_payments_entry_idx on public.erp_ledger_payments(entry_id);
create index erp_ledger_payments_creator_idx on public.erp_ledger_payments(created_by);
alter table public.erp_ledger_entries enable row level security;
alter table public.erp_ledger_payments enable row level security;
revoke all on public.erp_ledger_entries,public.erp_ledger_payments from public,anon,authenticated;
grant select on public.erp_ledger_entries,public.erp_ledger_payments to authenticated;
create policy erp_ledger_staff_read on public.erp_ledger_entries for select to authenticated
 using(private.current_app_role()::text in ('owner','manager'));
create policy erp_ledger_payment_staff_read on public.erp_ledger_payments for select to authenticated
 using(private.current_app_role()::text in ('owner','manager'));

-- Called only inside the validated/idempotent ERP action transaction.
create or replace function private.erp_ledger_action(p jsonb) returns uuid
language plpgsql set search_path='' as $$
declare v uuid; entry public.erp_ledger_entries; amt numeric; paid numeric; kind text; category text;
 record_day date; due_day date; method public.payment_method; acc text; offset_acc text;
begin
 if auth.uid() is null or coalesce(private.current_app_role()::text,'') not in ('owner','manager') then raise exception 'Manager access required'; end if;
 amt:=nullif(p->>'amount','')::numeric;
 if amt is null or amt<=0 or amt<>round(amt,2) or amt>=1000000000000 then raise exception 'Enter a positive amount with up to two decimal places'; end if;
 method:=coalesce(nullif(p->>'method',''),'cash')::public.payment_method;
 if method='mixed' then raise exception 'Record separate payments for each payment method'; end if;
 acc:=case when method='cash' then '1000' else '1010' end;
 if p->>'action'='ledger_entry' then
  kind:=p->>'kind';category:=p->>'category';
  if kind is null or category is null or not ((kind='receivable' and category in ('existing_balance','money_advance','service_income')) or
   (kind='payable' and category in ('existing_balance','money_borrowed','expense_owed'))) then raise exception 'Choose a valid ledger and balance type'; end if;
  if nullif(trim(p->>'full_name'),'') is null then raise exception 'Person or business name required'; end if;
  if nullif(trim(p->>'description'),'') is null then raise exception 'Description required'; end if;
  record_day:=nullif(p->>'record_date','')::date;due_day:=nullif(p->>'due_date','')::date;
  if record_day is null or not isfinite(record_day) or record_day>(now() at time zone 'Asia/Karachi')::date or
     (due_day is not null and (not isfinite(due_day) or due_day<record_day)) then raise exception 'Choose a valid record date and due date'; end if;
  if coalesce(length(p->>'mobile'),0)>25 or coalesce(length(p->>'reference'),0)>120 or coalesce(length(p->>'notes'),0)>2000 then raise exception 'Ledger details are too long'; end if;
  insert into public.erp_ledger_entries(kind,full_name,mobile,category,description,reference,amount,record_date,due_date,notes,created_by)
  values(kind,trim(p->>'full_name'),nullif(trim(p->>'mobile'),''),category,trim(p->>'description'),nullif(trim(p->>'reference'),''),amt,record_day,due_day,p->>'notes',auth.uid()) returning id into v;
  offset_acc:=case category when 'existing_balance' then '3000' when 'service_income' then '4000' when 'expense_owed' then '5100' else acc end;
  perform private.erp_post('ledger_entry',v,trim(p->>'description'),case when kind='receivable' then
   jsonb_build_array(jsonb_build_object('account','1100','debit',amt),jsonb_build_object('account',offset_acc,'credit',amt)) else
   jsonb_build_array(jsonb_build_object('account',offset_acc,'debit',amt),jsonb_build_object('account','2000','credit',amt)) end);
  if record_day<(now() at time zone 'Asia/Karachi')::date then
   update public.erp_journals set posted_at=record_day::timestamp at time zone 'Asia/Karachi' where source_type='ledger_entry' and source_id=v;
  end if;
 elsif p->>'action'='ledger_payment' then
  select * into entry from public.erp_ledger_entries where id=(p->>'entry_id')::uuid for update;
  if not found then raise exception 'Ledger entry not found'; end if;
  select coalesce(sum(amount),0) into paid from public.erp_ledger_payments where entry_id=entry.id;
  if amt>entry.amount-paid then raise exception 'Payment exceeds outstanding balance'; end if;
  if coalesce(length(p->>'notes'),0)>2000 then raise exception 'Payment notes are too long'; end if;
  insert into public.erp_ledger_payments(entry_id,amount,method,notes,created_by) values(entry.id,amt,method,p->>'notes',auth.uid()) returning id into v;
  perform private.erp_post('ledger_payment',v,case when entry.kind='receivable' then 'Other receivable receipt: ' else 'Other payable payment: ' end||entry.full_name,
   case when entry.kind='receivable' then jsonb_build_array(jsonb_build_object('account',acc,'debit',amt),jsonb_build_object('account','1100','credit',amt)) else
   jsonb_build_array(jsonb_build_object('account','2000','debit',amt),jsonb_build_object('account',acc,'credit',amt)) end);
 else raise exception 'Unknown ledger action'; end if;
 return v;
end $$;

create or replace function private.erp_read_extra(store jsonb) returns jsonb
language plpgsql stable set search_path='' as $$
declare r text:=private.current_app_role()::text; extra jsonb;
begin
 if auth.uid() is null or r is null then raise exception 'Active staff account required'; end if;
 if r<>'owner' then store:=store-'sessions'; end if;
 if r in ('owner','manager') then
  store:=store||jsonb_build_object(
   'ledgerEntries',coalesce((select jsonb_agg(e order by e.record_date desc,e.created_at desc) from public.erp_ledger_entries e),'[]'),
   'ledgerPayments',coalesce((select jsonb_agg(p order by p.payment_date desc) from public.erp_ledger_payments p),'[]'));
 end if;
 if r='owner' then
  select coalesce(jsonb_agg(x),'[]') into extra from (
   select s.id sale_id,s.final_total revenue,coalesce(sum(c.cost_price_snapshot),0) purchase_cost,
    case when count(i.id)=count(c.sale_item_id) then s.final_total-coalesce(sum(c.cost_price_snapshot),0) end gross_profit,
    count(i.id)=count(c.sale_item_id) costs_complete
   from public.sales s left join public.sale_items i on i.sale_id=s.id left join public.sale_item_costs c on c.sale_item_id=i.id
   where not s.is_opening_balance group by s.id
  ) x;
  store:=store||jsonb_build_object('invoiceProfits',extra);
 end if;
 return store;
end $$;
revoke all on function private.erp_ledger_action(jsonb),private.erp_read_extra(jsonb) from public,anon,authenticated;

-- Owner-only closing in both the action API and direct table reads.
drop policy if exists erp_session_staff_read on public.daily_sessions;
do $patch$
declare definition text; guard text:=$guard$ if a in ('open_day','close_day') and r<>'owner' then raise exception 'Owner access required'; end if;
$guard$;
begin
 definition:=pg_get_functiondef('private.erp_action(jsonb)'::regprocedure);
 if strpos(definition,' req:=(p->>''request_id'')::uuid;')=0 or strpos(definition,' elsif a=''purchase'' then')=0 then raise exception 'Unexpected ERP action version'; end if;
 if strpos(definition,guard)=0 then definition:=replace(definition,' req:=(p->>''request_id'')::uuid;',guard||' req:=(p->>''request_id'')::uuid;'); end if;
 if strpos(definition,'private.erp_ledger_action(p)')=0 then
 definition:=replace(definition,' elsif a=''purchase'' then',' elsif a in (''ledger_entry'',''ledger_payment'') then'||chr(10)||' v:=private.erp_ledger_action(p);'||chr(10)||' elsif a=''purchase'' then'); end if;
 if strpos(definition,'Purchase cost required')=0 then
  definition:=replace(definition,' elsif a=''purchase'' then',$purchase$ elsif a='purchase' then
 if nullif(trim(p->>'storage'),'') is null then raise exception 'Storage required'; end if;
 if nullif(trim(p->>'pta_status'),'') is null then raise exception 'PTA status required'; end if;
 if nullif(trim(p->>'purchase_price'),'') is null then raise exception 'Purchase cost required'; end if;$purchase$);
 end if;
 execute definition;
 definition:=pg_get_functiondef('private.erp_read()'::regprocedure);
 if strpos(definition,'private.erp_read_extra(result)')=0 then
  if strpos(definition,' return result;')=0 then raise exception 'Unexpected ERP read version'; end if;
  execute replace(definition,' return result;',' return private.erp_read_extra(result);');
 end if;
 -- Daily backups and snapshots taken before cleanup include both new ledger tables.
 definition:=pg_get_functiondef('private.erp_backup()'::regprocedure);
 if strpos(definition,'''erp_ledger_entries''')=0 then
  if strpos(definition,'''accessories'',''sold_phones'']')=0 then raise exception 'Unexpected backup version'; end if;
  execute replace(definition,'''accessories'',''sold_phones'']','''accessories'',''sold_phones'',''erp_ledger_entries'',''erp_ledger_payments'']');
 end if;
 definition:=pg_get_functiondef('private.erp_cleanup_delete(date,date,text,text,uuid)'::regprocedure);
 if strpos(definition,'''erp_ledger_entries''')=0 then
  if strpos(definition,'''accessories'',''sold_phones'']')=0 then raise exception 'Unexpected cleanup snapshot version'; end if;
  execute replace(definition,'''accessories'',''sold_phones'']','''accessories'',''sold_phones'',''erp_ledger_entries'',''erp_ledger_payments'']');
 end if;
end $patch$;
notify pgrst,'reload schema';
