-- Additive upgrade of the existing AppleSpace project. Existing data is retained.
create schema if not exists private;
alter table public.inventory_items add column if not exists serial_number text;
alter table public.inventory_items add column if not exists warranty_notes text;
alter table public.inventory_items add column if not exists condition_grade text;
create table public.supplier_payments (id uuid primary key default gen_random_uuid(),purchase_id uuid not null references public.purchases(id),amount numeric(14,2) not null check(amount>0),method public.payment_method not null default 'cash',payment_date timestamptz not null default now(),notes text,created_by uuid references public.user_profiles(id));
create table public.expenses (id uuid primary key default gen_random_uuid(),category text not null,description text not null,amount numeric(14,2) not null check(amount>0),method public.payment_method not null default 'cash',expense_date timestamptz not null default now(),created_by uuid references public.user_profiles(id));
create table public.daily_sessions (id uuid primary key default gen_random_uuid(),business_date date unique not null,opening_cash numeric(14,2) not null check(opening_cash>=0),opened_at timestamptz not null default now(),closed_at timestamptz,expected_cash numeric(14,2),counted_cash numeric(14,2),variance numeric(14,2),notes text,created_by uuid references public.user_profiles(id));
create table public.erp_accounts (code text primary key,name text not null,kind text not null check(kind in ('asset','liability','equity','income','expense')));
insert into public.erp_accounts values ('1000','Cash','asset'),('1010','Bank & digital wallets','asset'),('1100','Customer receivables','asset'),('1200','Phone inventory','asset'),('2000','Supplier payables','liability'),('3000','Owner capital','equity'),('4000','Sales revenue','income'),('5000','Cost of goods sold','expense'),('5100','Operating expenses','expense');
create table public.erp_journals (id uuid primary key default gen_random_uuid(),source_type text not null,source_id uuid not null,description text not null,posted_at timestamptz not null default now(),created_by uuid,unique(source_type,source_id));
create table public.erp_journal_lines (id bigint generated always as identity primary key,journal_id uuid not null references public.erp_journals(id),account_code text not null references public.erp_accounts(code),debit numeric(14,2) not null default 0 check(debit>=0),credit numeric(14,2) not null default 0 check(credit>=0),check((debit>0 and credit=0) or (credit>0 and debit=0)));
create table public.erp_audit (id bigint generated always as identity primary key,actor uuid,action text not null,record_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.erp_backups (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),data jsonb not null);
create table private.erp_requests (request_id uuid primary key,actor uuid not null,result jsonb not null,created_at timestamptz not null default now());
create unique index erp_one_open_cash_day on public.daily_sessions((true)) where closed_at is null;
create index on public.supplier_payments(purchase_id);
create index on public.erp_journal_lines(account_code);
create index on public.erp_journal_lines(journal_id);
create index on public.erp_journals(posted_at);
create index on public.erp_audit(created_at);
create index on public.sales(customer_id);
create index on public.purchases(seller_id);
create index on public.payments(sale_id);
create index on public.sale_items(sale_id);
create index on public.sale_items(inventory_item_id);
create unique index erp_one_sale_per_phone on public.sale_items(inventory_item_id) where inventory_item_id is not null;
-- Sensitive tables can only be written through validated, atomic RPC transactions.
do $$ declare t text; begin
 foreach t in array array['supplier_payments','expenses','daily_sessions','erp_accounts','erp_journals','erp_journal_lines','erp_audit','erp_backups'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy erp_owner_read on public.%I for select to authenticated using (private.current_app_role() = ''owner'')',t);
 end loop;
end $$;
create policy erp_session_staff_read on public.daily_sessions for select to authenticated using(private.current_app_role() in ('owner','manager','salesperson'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('seller-photos','seller-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy erp_photo_read on storage.objects for select to authenticated using(bucket_id='seller-photos' and private.current_app_role() in ('owner','manager'));
create policy erp_photo_insert on storage.objects for insert to authenticated with check(bucket_id='seller-photos' and private.current_app_role() in ('owner','manager') and (storage.foldername(name))[1]=auth.uid()::text);
create policy erp_photo_delete on storage.objects for delete to authenticated using(bucket_id='seller-photos' and private.current_app_role() in ('owner','manager') and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function private.erp_post(kind text,ref uuid,description text,entries jsonb) returns void language plpgsql set search_path='' as $$
declare jid uuid; e jsonb; begin
 if (select coalesce(sum((x->>'debit')::numeric),0)-coalesce(sum((x->>'credit')::numeric),0) from jsonb_array_elements(entries) x) <> 0 then raise exception 'Unbalanced journal'; end if;
 insert into public.erp_journals(source_type,source_id,description,created_by) values(kind,ref,description,auth.uid()) returning id into jid;
 for e in select * from jsonb_array_elements(entries) loop
 if coalesce((e->>'debit')::numeric,0)+coalesce((e->>'credit')::numeric,0)>0 then
 insert into public.erp_journal_lines(journal_id,account_code,debit,credit) values(jid,e->>'account',coalesce((e->>'debit')::numeric,0),coalesce((e->>'credit')::numeric,0)); end if;
 end loop;
end $$;
create or replace function private.erp_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r text; result jsonb; begin
 r:=private.current_app_role()::text;
 if auth.uid() is null or r is null then raise exception 'Active staff account required'; end if;
 select jsonb_build_object(
 'profile',(select to_jsonb(p) from public.user_profiles p where p.id=auth.uid()),
 'inventory',coalesce((select jsonb_agg(case when r='salesperson' then to_jsonb(i)-'purchase_price'-'purchase_id'-'additional_details' else to_jsonb(i) end order by i.created_at desc) from public.inventory_items i),'[]'),
 'accessories',coalesce((select jsonb_agg(case when r='salesperson' then to_jsonb(a)-'purchase_price'-'supplier_id'-'purchase_id' else to_jsonb(a) end order by a.created_at desc) from public.accessories a),'[]'),
 'customers',coalesce((select jsonb_agg(c order by c.created_at desc) from public.customers c),'[]'),
 'sales',coalesce((select jsonb_agg(s order by s.sale_date desc) from public.sales s),'[]'),
 'saleItems',coalesce((select jsonb_agg(s) from public.sale_items s),'[]'),
 'payments',coalesce((select jsonb_agg(p order by p.payment_date desc) from public.payments p),'[]'),
 'sessions',coalesce((select jsonb_agg(d order by d.business_date desc) from public.daily_sessions d),'[]')
 ) into result;
 if r in ('owner','manager') then result:=result||jsonb_build_object(
 'suppliers',coalesce((select jsonb_agg(s order by s.created_at desc) from public.sellers s),'[]'),
 'purchases',coalesce((select jsonb_agg(p order by p.purchase_date desc) from public.purchases p),'[]'),
 'supplierPayments',coalesce((select jsonb_agg(p) from public.supplier_payments p),'[]'),
 'expenses',coalesce((select jsonb_agg(e order by e.expense_date desc) from public.expenses e),'[]'));
 end if;
 if r='owner' then result:=result||jsonb_build_object(
 'costs',coalesce((select jsonb_agg(c) from public.sale_item_costs c),'[]'),
 'accounts',coalesce((select jsonb_agg(x) from (select a.*,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit from public.erp_accounts a left join public.erp_journal_lines l on l.account_code=a.code group by a.code order by a.code) x),'[]'),
 'journals',coalesce((select jsonb_agg(x) from (select j.*,coalesce((select jsonb_agg(l) from public.erp_journal_lines l where l.journal_id=j.id),'[]') lines from public.erp_journals j order by posted_at desc) x),'[]'),
 'audit',coalesce((select jsonb_agg(x) from (select * from public.erp_audit order by created_at desc limit 200) x),'[]'),
 'staff',coalesce((select jsonb_agg(p) from public.user_profiles p),'[]'),
 'backups',coalesce((select jsonb_agg(x) from (select id,created_at from public.erp_backups order by created_at desc limit 30) x),'[]'));
 end if;
 return result;
end $$;
create or replace function public.erp_read() returns jsonb language sql security invoker set search_path='' as $$ select private.erp_read(); $$;
revoke all on function private.erp_read() from public,anon;
grant execute on function private.erp_read() to authenticated;
revoke all on function public.erp_read() from public,anon;
grant execute on function public.erp_read() to authenticated;
create or replace function private.erp_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; a text:=p->>'action'; v uuid; sid uuid; iid uuid; item public.inventory_items; amt numeric; price numeric; discount numeric; total numeric; paid numeric; balance numeric; method public.payment_method; acc text; result jsonb; req uuid; op public.daily_sessions; expected numeric; delta numeric; new_total numeric; stock public.accessories; qty integer; remaining numeric; pay_part numeric; purchase_row record;
begin
 r:=private.current_app_role()::text;
 if auth.uid() is null or r is null then raise exception 'Active staff account required'; end if;
 req:=(p->>'request_id')::uuid;
 if req is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select q.result into result from private.erp_requests q where q.request_id=req and q.actor=auth.uid();
 if found then return result; end if;
 if a not in ('sale','customer','customer_edit','customer_payment','open_day','close_day') and r not in ('owner','manager') then raise exception 'Manager access required'; end if;
 method:=coalesce(p->>'method','cash')::public.payment_method;
 if method='mixed' then raise exception 'Record separate payments for each payment method'; end if;
 acc:=case when method='cash' then '1000' else '1010' end;
 amt:=coalesce((p->>'amount')::numeric,0);
 if amt<>round(amt,2) then raise exception 'Amounts support two decimal places'; end if;
 if a='customer' then
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 insert into public.customers(full_name,mobile,cnic,address,notes) values(trim(p->>'full_name'),nullif(p->>'mobile',''),nullif(p->>'cnic',''),nullif(p->>'address',''),p->>'notes') returning id into v;
 elsif a in ('customer_edit','supplier_edit') then
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 v:=(p->>'id')::uuid;
 if a='customer_edit' then
 update public.customers set full_name=trim(p->>'full_name'),mobile=nullif(p->>'mobile',''),cnic=nullif(p->>'cnic',''),address=nullif(p->>'address',''),notes=p->>'notes' where id=v;
 else
 update public.sellers set full_name=trim(p->>'full_name'),mobile=nullif(p->>'mobile',''),cnic=nullif(p->>'cnic',''),notes=p->>'notes' where id=v;
 end if;
 if not found then raise exception 'Contact not found'; end if;
 elsif a='supplier' then
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 insert into public.sellers(full_name,mobile,cnic,notes) values(trim(p->>'full_name'),nullif(p->>'mobile',''),nullif(p->>'cnic',''),p->>'notes') returning id into v;
 elsif a='purchase' then
 price:=(p->>'purchase_price')::numeric; paid:=coalesce((p->>'paid')::numeric,0);
 if price is null or price<=0 or price<>round(price,2) or paid<>round(paid,2) or paid<0 or paid>price then raise exception 'Invalid price or payment'; end if;
 if nullif(trim(p->>'model'),'') is null then raise exception 'Model required'; end if;
 if nullif(p->>'imei_1','') is null and nullif(p->>'serial_number','') is null then raise exception 'IMEI or serial required'; end if;
 if nullif(p->>'imei_1','') is not null and p->>'imei_1' !~ '^\d{15}$' then raise exception 'IMEI must contain 15 digits'; end if;
 if nullif(p->>'imei_2','') is not null and p->>'imei_2' !~ '^\d{15}$' then raise exception 'IMEI 2 must contain 15 digits'; end if;
 if nullif(p->>'imei_1','')=nullif(p->>'imei_2','') then raise exception 'IMEI 1 and IMEI 2 must differ'; end if;
 perform pg_advisory_xact_lock(812344);
 if exists(select 1 from public.inventory_items i where (nullif(p->>'imei_1','') is not null and (i.imei_1=p->>'imei_1' or i.imei_2=p->>'imei_1')) or (nullif(p->>'imei_2','') is not null and (i.imei_1=p->>'imei_2' or i.imei_2=p->>'imei_2')) or (nullif(p->>'serial_number','') is not null and i.serial_number=p->>'serial_number')) then raise exception 'IMEI or serial already exists in inventory'; end if;
 sid:=nullif(p->>'supplier_id','')::uuid;
 if sid is null then
 if nullif(trim(p->>'supplier_name'),'') is null then raise exception 'Supplier name required'; end if;
 insert into public.sellers(full_name,mobile,cnic,photo_url) values(trim(p->>'supplier_name'),nullif(p->>'mobile',''),nullif(p->>'cnic',''),p->>'photo_url') returning id into sid;
 elsif nullif(p->>'photo_url','') is not null then update public.sellers set photo_url=p->>'photo_url' where id=sid;
 end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,price,p->>'notes',auth.uid()) returning id into v;
 insert into public.inventory_items(purchase_id,stock_code,barcode_value,model,storage,color,imei_1,imei_2,serial_number,battery_health,pta_status,purchase_price,default_sale_price,condition_grade,warranty_notes,created_by)
 values(v,'','',trim(p->>'model'),p->>'storage',p->>'color',nullif(p->>'imei_1',''),nullif(p->>'imei_2',''),nullif(p->>'serial_number',''),nullif(p->>'battery_health','')::smallint,coalesce(p->>'pta_status','non_pta')::public.pta_status,price,nullif(p->>'sale_price','')::numeric,p->>'condition_grade',p->>'warranty_notes',auth.uid()) returning id into iid;
 insert into public.stock_movements(inventory_item_id,movement_type,to_status,reference_type,reference_id,created_by) values(iid,'purchase','in_stock','purchase',v,auth.uid());
 perform private.erp_post('purchase',v,'Phone purchase',jsonb_build_array(jsonb_build_object('account','1200','debit',price),jsonb_build_object('account','2000','credit',price)));
 if paid>0 then
 insert into public.supplier_payments(purchase_id,amount,method,created_by) values(v,paid,method,auth.uid()) returning id into sid;
 perform private.erp_post('supplier_payment',sid,'Supplier payment',jsonb_build_array(jsonb_build_object('account','2000','debit',paid),jsonb_build_object('account',acc,'credit',paid)));
 end if;
 elsif a='sale' then
 select * into item from public.inventory_items where id=(p->>'inventory_id')::uuid for update;
 if not found or item.status<>'in_stock' then raise exception 'Phone is no longer available'; end if;
 price:=(p->>'price')::numeric; discount:=coalesce((p->>'discount')::numeric,0); paid:=coalesce((p->>'paid')::numeric,0); total:=price-discount;
 if price is null or price<=0 or discount<0 or total<=0 or paid<0 or paid>total or price<>round(price,2) or discount<>round(discount,2) or paid<>round(paid,2) then raise exception 'Invalid sale amounts'; end if;
 sid:=nullif(p->>'customer_id','')::uuid;
 if paid<total and sid is null then raise exception 'Select a customer for a credit sale'; end if;
 insert into public.sales(invoice_number,customer_id,subtotal,discount,final_total,payment_status,warranty_notes,sold_by) values('AS-'||to_char(now() at time zone 'Asia/Karachi','YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,8)),sid,price,discount,total,case when paid=total then 'paid'::public.payment_status when paid>0 then 'partial'::public.payment_status else 'unpaid'::public.payment_status end,p->>'warranty_notes',auth.uid()) returning id into v;
 insert into public.sale_items(sale_id,inventory_item_id,item_name,unit_price,discount,final_price) values(v,item.id,item.model,price,discount,total) returning id into iid;
 insert into public.sale_item_costs(sale_item_id,cost_price_snapshot) values(iid,item.purchase_price);
 update public.inventory_items set status='sold',sold_at=now() where id=item.id;
 insert into public.stock_movements(inventory_item_id,movement_type,from_status,to_status,reference_type,reference_id,created_by) values(item.id,'sale','in_stock','sold','sale',v,auth.uid());
 perform private.erp_post('sale',v,'Invoice sale',jsonb_build_array(jsonb_build_object('account','1100','debit',total),jsonb_build_object('account','4000','credit',total),jsonb_build_object('account','5000','debit',item.purchase_price),jsonb_build_object('account','1200','credit',item.purchase_price)));
 if paid>0 then
 insert into public.payments(sale_id,amount,method,received_by) values(v,paid,method,auth.uid()) returning id into iid;
 perform private.erp_post('customer_payment',iid,'Sale receipt',jsonb_build_array(jsonb_build_object('account',acc,'debit',paid),jsonb_build_object('account','1100','credit',paid)));
 end if;
 elsif a='customer_payment' then
 v:=(p->>'sale_id')::uuid;
 select final_total into total from public.sales where id=v for update;
 if not found then raise exception 'Invoice not found'; end if;
 select total-coalesce(sum(amount),0) into balance from public.payments where sale_id=v;
 if amt<=0 or amt>balance then raise exception 'Payment exceeds outstanding balance'; end if;
 insert into public.payments(sale_id,amount,method,received_by,notes) values(v,amt,method,auth.uid(),p->>'notes') returning id into iid;
 update public.sales set payment_status=case when amt=balance then 'paid'::public.payment_status else 'partial'::public.payment_status end where id=v;
 perform private.erp_post('customer_payment',iid,'Customer receipt',jsonb_build_array(jsonb_build_object('account',acc,'debit',amt),jsonb_build_object('account','1100','credit',amt)));
 elsif a='supplier_payment_bulk' then
 sid:=(p->>'supplier_id')::uuid;
 if not exists(select 1 from public.sellers where id=sid) then raise exception 'Supplier not found'; end if;
 perform 1 from public.purchases where seller_id=sid order by purchase_date,id for update;
 select coalesce(sum(greatest(total_amount-coalesce((select sum(amount) from public.supplier_payments sp where sp.purchase_id=pu.id),0),0)),0) into balance from public.purchases pu where seller_id=sid;
 if amt<=0 or amt>balance then raise exception 'Payment exceeds supplier outstanding balance'; end if;
 remaining:=amt;
 for purchase_row in select pu.id,greatest(pu.total_amount-coalesce((select sum(amount) from public.supplier_payments sp where sp.purchase_id=pu.id),0),0) as due from public.purchases pu where seller_id=sid order by pu.purchase_date,pu.id loop
 exit when remaining=0;
 pay_part:=least(remaining,purchase_row.due);
 if pay_part>0 then
 insert into public.supplier_payments(purchase_id,amount,method,created_by,notes) values(purchase_row.id,pay_part,method,auth.uid(),p->>'notes') returning id into iid;
 perform private.erp_post('supplier_payment',iid,'Supplier payment - oldest purchase first',jsonb_build_array(jsonb_build_object('account','2000','debit',pay_part),jsonb_build_object('account',acc,'credit',pay_part)));
 remaining:=remaining-pay_part;
 end if;
 end loop;
 v:=sid;
 elsif a='supplier_payment' then
 v:=(p->>'purchase_id')::uuid;
 select total_amount into total from public.purchases where id=v for update;
 if not found then raise exception 'Purchase not found'; end if;
 select total-coalesce(sum(amount),0) into balance from public.supplier_payments where purchase_id=v;
 if amt<=0 or amt>balance then raise exception 'Payment exceeds outstanding payable'; end if;
 insert into public.supplier_payments(purchase_id,amount,method,created_by,notes) values(v,amt,method,auth.uid(),p->>'notes') returning id into iid;
 perform private.erp_post('supplier_payment',iid,'Supplier payment',jsonb_build_array(jsonb_build_object('account','2000','debit',amt),jsonb_build_object('account',acc,'credit',amt)));
 elsif a='expense' then
 if amt<=0 or nullif(trim(p->>'description'),'') is null then raise exception 'Description and positive amount required'; end if;
 insert into public.expenses(category,description,amount,method,created_by) values(coalesce(nullif(p->>'category',''),'Other'),p->>'description',amt,method,auth.uid()) returning id into v;
 perform private.erp_post('expense',v,p->>'description',jsonb_build_array(jsonb_build_object('account','5100','debit',amt),jsonb_build_object('account',acc,'credit',amt)));
 elsif a='capital' then
 if r<>'owner' or amt<=0 then raise exception 'Owner and positive amount required'; end if;
 v:=gen_random_uuid(); perform private.erp_post('capital',v,'Owner capital contribution',jsonb_build_array(jsonb_build_object('account',acc,'debit',amt),jsonb_build_object('account','3000','credit',amt)));
 elsif a='open_day' then
 if exists(select 1 from public.daily_sessions where closed_at is null) then raise exception 'Close the previous cash day before opening another'; end if;
 if amt<0 then raise exception 'Invalid opening cash'; end if;
 insert into public.daily_sessions(business_date,opening_cash,created_by,notes) values((now() at time zone 'Asia/Karachi')::date,amt,auth.uid(),p->>'notes') returning id into v;
 elsif a='close_day' then
 select * into op from public.daily_sessions where id=(p->>'session_id')::uuid for update;
 if not found or op.closed_at is not null then raise exception 'Open day required'; end if;
 if amt<0 then raise exception 'Counted cash cannot be negative'; end if;
 select op.opening_cash+coalesce(sum(l.debit-l.credit),0) into expected from public.erp_journal_lines l join public.erp_journals j on j.id=l.journal_id where l.account_code='1000' and j.posted_at>=op.opened_at;
 update public.daily_sessions set closed_at=now(),expected_cash=expected,counted_cash=amt,variance=amt-expected,notes=p->>'notes' where id=op.id;
 v:=op.id;
 elsif a='accessory_purchase' then
 price:=(p->>'purchase_price')::numeric; qty:=(p->>'quantity')::integer; paid:=coalesce((p->>'paid')::numeric,0);
 if nullif(trim(p->>'name'),'') is null or qty is null or qty<=0 or price is null or price<0 or price<>round(price,2) then raise exception 'Accessory name, quantity and valid unit cost required'; end if;
 total:=price*qty;
 if paid<0 or paid>total or paid<>round(paid,2) then raise exception 'Invalid purchase payment'; end if;
 sid:=nullif(p->>'supplier_id','')::uuid;
 if sid is null then
 if nullif(trim(p->>'supplier_name'),'') is null then raise exception 'Supplier required'; end if;
 insert into public.sellers(full_name) values(trim(p->>'supplier_name')) returning id into sid;
 end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,total,p->>'notes',auth.uid()) returning id into v;
 insert into public.accessories(name,category,sku,quantity,purchase_price,sale_price,supplier_id,purchase_id,notes,created_by) values(trim(p->>'name'),coalesce(nullif(p->>'category',''),'Other'),'ACC-'||upper(substr(gen_random_uuid()::text,1,8)),qty,price,nullif(p->>'sale_price','')::numeric,sid,v,p->>'notes',auth.uid()) returning id into iid;
 if total>0 then perform private.erp_post('purchase',v,'Accessory purchase',jsonb_build_array(jsonb_build_object('account','1200','debit',total),jsonb_build_object('account','2000','credit',total))); end if;
 if paid>0 then
 insert into public.supplier_payments(purchase_id,amount,method,created_by) values(v,paid,method,auth.uid()) returning id into sid;
 perform private.erp_post('supplier_payment',sid,'Accessory purchase payment',jsonb_build_array(jsonb_build_object('account','2000','debit',paid),jsonb_build_object('account',acc,'credit',paid)));
 end if;
 elsif a='accessory_edit' then
 v:=(p->>'accessory_id')::uuid;
 select * into stock from public.accessories where id=v for update;
 if not found then raise exception 'Accessory not found'; end if;
 if nullif(trim(p->>'name'),'') is null then raise exception 'Accessory name required'; end if;
 update public.accessories set name=trim(p->>'name'),category=coalesce(nullif(p->>'category',''),'Other'),sale_price=nullif(p->>'sale_price','')::numeric,notes=p->>'notes',updated_at=now() where id=v;
 elsif a='phone_expense' then
 v:=(p->>'inventory_id')::uuid;
 select * into item from public.inventory_items where id=v for update;
 if not found then raise exception 'Phone not found'; end if;
 if amt<=0 or nullif(trim(p->>'description'),'') is null then raise exception 'Description and positive amount required'; end if;
 insert into public.expenses(inventory_item_id,category,description,amount,method,created_by) values(v,coalesce(nullif(p->>'category',''),'Phone expense'),p->>'description',amt,method,auth.uid()) returning id into iid;
 perform private.erp_post('expense',iid,'Phone expense: '||item.stock_code,jsonb_build_array(jsonb_build_object('account','5100','debit',amt),jsonb_build_object('account',acc,'credit',amt)));
 elsif a='repair' then
 v:=(p->>'inventory_id')::uuid;
 select * into item from public.inventory_items where id=v for update;
 if not found or item.status not in ('in_stock','repair') then raise exception 'Only in-stock or repairing phones can change repair status'; end if;
 if not(p ? 'repairing') then raise exception 'Repair checkbox value required'; end if;
 update public.inventory_items set status=case when (p->>'repairing')::boolean then 'repair'::public.inventory_status else 'in_stock'::public.inventory_status end where id=v;
 if item.status<>(select status from public.inventory_items where id=v) then
 insert into public.stock_movements(inventory_item_id,movement_type,from_status,to_status,reference_type,reference_id,notes,created_by) values(v,case when (p->>'repairing')::boolean then 'repair_in'::public.stock_movement_type else 'repair_out'::public.stock_movement_type end,item.status,case when (p->>'repairing')::boolean then 'repair'::public.inventory_status else 'in_stock'::public.inventory_status end,'inventory',v,'Repair checkbox updated',auth.uid());
 end if;
 elsif a='inventory_edit' then
 v:=(p->>'inventory_id')::uuid;
 select * into item from public.inventory_items where id=v for update;
 if not found or item.status='sold' then raise exception 'Only unsold phones can be edited'; end if;
 if p->>'status' not in ('in_stock','reserved','repair') then raise exception 'Invalid stock status'; end if;
 price:=coalesce(nullif(p->>'purchase_price','')::numeric,item.purchase_price);
 if price<0 or price<>round(price,2) then raise exception 'Invalid purchase price'; end if;
 if nullif(p->>'sale_price','') is not null and ((p->>'sale_price')::numeric<0 or (p->>'sale_price')::numeric<>round((p->>'sale_price')::numeric,2)) then raise exception 'Invalid sale price'; end if;
 delta:=price-item.purchase_price;
 if delta<>0 then
 if item.purchase_id is null then raise exception 'Phone needs a linked purchase to correct its cost'; end if;
 select total_amount into total from public.purchases where id=item.purchase_id for update;
 select coalesce(sum(amount),0) into paid from public.supplier_payments where purchase_id=item.purchase_id;
 new_total:=total+delta;
 if new_total<paid then raise exception 'New purchase total is below payments already made. Reconcile supplier credit first'; end if;
 update public.purchases set total_amount=new_total where id=item.purchase_id;
 update public.inventory_items set purchase_price=price where id=v;
 perform private.erp_post('purchase_price_adjustment',req,'Purchase cost correction: '||item.stock_code,jsonb_build_array(jsonb_build_object('account','1200','debit',greatest(delta,0),'credit',greatest(-delta,0)),jsonb_build_object('account','2000','debit',greatest(-delta,0),'credit',greatest(delta,0))));
 end if;
 update public.inventory_items set status=(p->>'status')::public.inventory_status,default_sale_price=nullif(p->>'sale_price','')::numeric,battery_health=nullif(p->>'battery_health','')::smallint,color=p->>'color',condition_grade=p->>'condition_grade',warranty_notes=p->>'warranty_notes',public_notes=p->>'public_notes' where id=v;
 if item.status::text<>p->>'status' then
 insert into public.stock_movements(inventory_item_id,movement_type,from_status,to_status,reference_type,reference_id,created_by) values(v,'adjustment',item.status,(p->>'status')::public.inventory_status,'inventory',v,auth.uid());
 end if;
 elsif a='website' then
 update public.inventory_items set show_on_website=coalesce((p->>'visible')::boolean,false),website_price=nullif(p->>'price','')::numeric,website_title=nullif(p->>'title',''),website_description=p->>'description' where id=(p->>'inventory_id')::uuid and status='in_stock' returning id into v;
 if not found then raise exception 'In-stock phone required'; end if;
 if (p->>'visible')::boolean and nullif(p->>'price','') is null then raise exception 'Website price required'; end if;
 elsif a='staff' then
 if r<>'owner' then raise exception 'Owner required'; end if;
 v:=(p->>'id')::uuid;
 if v=auth.uid() then raise exception 'Cannot change your own access'; end if;
 insert into public.user_profiles(id,full_name,role,is_active) values(v,coalesce(nullif(p->>'full_name',''),'Staff'),(p->>'role')::public.app_role,(p->>'is_active')::boolean)
 on conflict(id) do update set role=excluded.role,is_active=excluded.is_active,full_name=coalesce(nullif(p->>'full_name',''),public.user_profiles.full_name);
 else raise exception 'Unknown action'; end if;
 result:=jsonb_build_object('id',v,'inventory_id',iid);
 insert into public.erp_audit(actor,action,record_id,details) values(auth.uid(),a,v,jsonb_build_object('request_id',req));
 insert into private.erp_requests(request_id,actor,result) values(req,auth.uid(),result);
 return result;
end $$;
create or replace function public.erp_action(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.erp_action(p); $$;
revoke all on function private.erp_action(jsonb) from public,anon;
grant execute on function private.erp_action(jsonb) to authenticated;
revoke all on function public.erp_action(jsonb) from public,anon;
grant execute on function public.erp_action(jsonb) to authenticated;
grant usage on schema private to authenticated;
-- Reconcile legacy purchases: no historic payment data existed, so these begin as unpaid.
do $$ declare p record; begin
 for p in select * from public.purchases loop
 perform private.erp_post('purchase',p.id,'Legacy purchase - payment reconciliation required',jsonb_build_array(jsonb_build_object('account','1200','debit',p.total_amount),jsonb_build_object('account','2000','credit',p.total_amount)));
 end loop;
end $$;
-- Remove browser write access that would bypass accounting and atomic stock transitions.
revoke insert,update,delete on public.purchases,public.inventory_items,public.sales,public.sale_items,public.payments,public.sale_item_costs,public.stock_movements from authenticated;
do $$ declare f record; begin for f in select oid::regprocedure as sig from pg_proc where pronamespace='public'::regnamespace and proname='create_phone_purchase' loop execute format('revoke execute on function %s from public,anon,authenticated',f.sig); end loop; end $$;
-- Daily internal snapshots; off-site physical backups require provider backup configuration.
create or replace function private.erp_backup() returns uuid language plpgsql security definer set search_path='' as $$
declare d jsonb:='{}'; t text; v uuid; x jsonb; begin
 foreach t in array array['user_profiles','sellers','customers','purchases','inventory_items','sales','sale_items','payments','sale_item_costs','supplier_payments','expenses','daily_sessions','erp_accounts','erp_journals','erp_journal_lines','erp_audit','product_images','stock_movements','accessories'] loop
 execute format('select coalesce(jsonb_agg(t),''[]''::jsonb) from public.%I t',t) into x;
 d:=d||jsonb_build_object(t,x);
 end loop;
 insert into public.erp_backups(data) values(d) returning id into v;
 delete from public.erp_backups where created_at<now()-interval '30 days';
 return v;
end $$;
revoke all on function private.erp_backup() from public,anon,authenticated;
create or replace function private.erp_get_backup(ref uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v uuid; d jsonb; begin
 if auth.uid() is null or private.current_app_role() is distinct from 'owner'::public.app_role then raise exception 'Owner required'; end if;
 if ref is null then v:=private.erp_backup(); else v:=ref; end if;
 select data into d from public.erp_backups where id=v;
 return d;
end $$;
revoke all on function private.erp_get_backup(uuid) from public,anon;
grant execute on function private.erp_get_backup(uuid) to authenticated;
create or replace function public.erp_get_backup(ref uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.erp_get_backup(ref); $$;
revoke all on function public.erp_get_backup(uuid) from public,anon;
grant execute on function public.erp_get_backup(uuid) to authenticated;
create extension if not exists pg_cron;
select cron.schedule('applespace-daily-snapshot','0 21 * * *','select private.erp_backup()');
select private.erp_backup();
