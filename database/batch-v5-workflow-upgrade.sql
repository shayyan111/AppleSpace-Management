-- Batch V5: inventory lifecycle, split supplier directories, shopkeeper sales, CRM support, barcode-camera UI support.
-- Run after batch-v4-customers.sql.

alter table public.sellers drop constraint if exists sellers_seller_kind_check;
alter table public.sellers add constraint sellers_seller_kind_check check(seller_kind in ('supplier','walk_in','accessory_supplier'));
alter table public.sales add column if not exists sale_kind text not null default 'customer' check(sale_kind in ('customer','shopkeeper'));
alter table public.sales add column if not exists billed_by uuid references public.user_profiles(id);
alter table public.sales add column if not exists billed_by_name text;
update public.sales s set billed_by=coalesce(s.billed_by,s.sold_by),billed_by_name=coalesce(s.billed_by_name,(select u.full_name from public.user_profiles u where u.id=coalesce(s.billed_by,s.sold_by))) where s.billed_by is null or s.billed_by_name is null;

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
 'sessions',coalesce((select jsonb_agg(d order by d.business_date desc) from public.daily_sessions d),'[]'),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role,'is_active',p.is_active) order by p.full_name) from public.user_profiles p where p.is_active or r='owner'),'[]')
 ) into result;
 if r in ('owner','manager') then result:=result||jsonb_build_object(
 'suppliers',coalesce((select jsonb_agg(s order by s.created_at desc) from public.sellers s where s.seller_kind<>'walk_in'),'[]'),
 'walkInSellers',coalesce((select jsonb_agg(s order by s.created_at desc) from public.sellers s where s.seller_kind='walk_in'),'[]'),
 'purchases',coalesce((select jsonb_agg(p order by p.purchase_date desc) from public.purchases p),'[]'),
 'supplierPayments',coalesce((select jsonb_agg(p) from public.supplier_payments p),'[]'),
 'expenses',coalesce((select jsonb_agg(e order by e.expense_date desc) from public.expenses e),'[]'));
 end if;
 if r='owner' then result:=result||jsonb_build_object(
 'costs',coalesce((select jsonb_agg(c) from public.sale_item_costs c),'[]'),
 'accounts',coalesce((select jsonb_agg(x) from (select a.*,coalesce(sum(l.debit),0) debit,coalesce(sum(l.credit),0) credit from public.erp_accounts a left join public.erp_journal_lines l on l.account_code=a.code group by a.code order by a.code) x),'[]'),
 'journals',coalesce((select jsonb_agg(x) from (select j.*,coalesce((select jsonb_agg(l) from public.erp_journal_lines l where l.journal_id=j.id),'[]') lines from public.erp_journals j order by posted_at desc) x),'[]'),
 'audit',coalesce((select jsonb_agg(x) from (select * from public.erp_audit order by created_at desc limit 200) x),'[]'),
 'backups',coalesce((select jsonb_agg(x) from (select id,created_at from public.erp_backups order by created_at desc limit 30) x),'[]'));
 end if;
 return result;
end $$;

create or replace function private.erp_action(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; a text:=p->>'action'; v uuid; sid uuid; iid uuid; item public.inventory_items; amt numeric; price numeric; discount numeric; total numeric; paid numeric; balance numeric; method public.payment_method; acc text; result jsonb; req uuid; op public.daily_sessions; expected numeric; delta numeric; new_total numeric; seller public.sellers; seller_cnic text; seller_mobile text; seller_photo text; expense_id uuid; extra jsonb; extras jsonb; extra_total numeric; cost numeric; line_price numeric; extra_qty integer; stock public.accessories; qty integer; remaining numeric; pay_part numeric; purchase_row record;
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
 if coalesce(p->>'mobile','') !~ '^[0-9]{11}$' then raise exception '11-digit customer phone required'; end if;
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 insert into public.customers(full_name,mobile,cnic,address,notes,customer_kind) values(trim(p->>'full_name'),nullif(p->>'mobile',''),nullif(p->>'cnic',''),nullif(p->>'address',''),p->>'notes',coalesce(nullif(p->>'customer_kind',''),'customer')) returning id into v;
 elsif a in ('customer_edit','supplier_edit') then
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 v:=(p->>'id')::uuid;
 if a='customer_edit' then
 if coalesce(p->>'mobile','') !~ '^[0-9]{11}$' then raise exception '11-digit customer phone required'; end if;
 update public.customers set full_name=trim(p->>'full_name'),mobile=nullif(p->>'mobile',''),cnic=nullif(p->>'cnic',''),address=nullif(p->>'address',''),notes=p->>'notes' where id=v;
 else
 if coalesce(p->>'seller_kind','supplier') not in ('supplier','accessory_supplier') then raise exception 'Invalid supplier list'; end if;
 update public.sellers set full_name=trim(p->>'full_name'),mobile=nullif(p->>'mobile',''),cnic=nullif(p->>'cnic',''),notes=p->>'notes',seller_kind=coalesce(p->>'seller_kind','supplier') where id=v;
 end if;
 if not found then raise exception 'Contact not found'; end if;
 elsif a='supplier' then
 if nullif(trim(p->>'full_name'),'') is null then raise exception 'Name required'; end if;
 if coalesce(p->>'seller_kind','supplier') not in ('supplier','accessory_supplier') then raise exception 'Invalid supplier list'; end if;
 insert into public.sellers(full_name,mobile,cnic,notes,seller_kind) values(trim(p->>'full_name'),nullif(p->>'mobile',''),nullif(p->>'cnic',''),p->>'notes',coalesce(p->>'seller_kind','supplier')) returning id into v;
 elsif a='purchase' then
 price:=coalesce(nullif(p->>'purchase_price','')::numeric,0); paid:=coalesce(nullif(p->>'paid','')::numeric,0);
 if price<0 or price<>round(price,2) or paid<>round(paid,2) or paid<0 or paid>price then raise exception 'Invalid price or payment'; end if;
 if nullif(trim(p->>'model'),'') is null then raise exception 'Model required'; end if;
 if coalesce(p->>'imei_1','') !~ '^[0-9]{15}$' then raise exception 'IMEI 1 must contain 15 digits'; end if;
 if nullif(p->>'imei_1','') is not null and p->>'imei_1' !~ '^\d{15}$' then raise exception 'IMEI must contain 15 digits'; end if;
 if nullif(p->>'imei_2','') is not null and p->>'imei_2' !~ '^\d{15}$' then raise exception 'IMEI 2 must contain 15 digits'; end if;
 if nullif(p->>'imei_1','')=nullif(p->>'imei_2','') then raise exception 'IMEI 1 and IMEI 2 must differ'; end if;
 perform pg_advisory_xact_lock(812344);
 if exists(select 1 from public.inventory_items i where i.status<>'sold' and (
  (nullif(p->>'imei_1','') is not null and (i.imei_1=p->>'imei_1' or i.imei_2=p->>'imei_1')) or
  (nullif(p->>'imei_2','') is not null and (i.imei_1=p->>'imei_2' or i.imei_2=p->>'imei_2')) or
  (nullif(p->>'serial_number','') is not null and i.serial_number=p->>'serial_number')
 )) then raise exception 'IMEI or serial already exists in active inventory'; end if;
 sid:=nullif(p->>'supplier_id','')::uuid;
 if coalesce(p->>'seller_kind','supplier') not in ('supplier','walk_in') then raise exception 'Choose supplier or walk-in seller'; end if;
 if sid is not null then
 select * into seller from public.sellers where id=sid for update;
 if not found or seller.seller_kind<>coalesce(p->>'seller_kind','supplier') then raise exception 'Choose a seller from the correct supplier list'; end if;
 end if;
 seller_cnic:=coalesce(nullif(p->>'cnic',''),seller.cnic);
 seller_mobile:=coalesce(nullif(p->>'mobile',''),seller.mobile);
 seller_photo:=coalesce(nullif(p->>'photo_url',''),seller.photo_url);
 if coalesce(seller_cnic,'') !~ '^[0-9]{13}$' then raise exception 'Seller CNIC must contain 13 digits'; end if;
 if coalesce(seller_mobile,'') !~ '^[0-9]{11}$' then raise exception 'Seller mobile must contain 11 digits'; end if;
 if coalesce(p->>'seller_kind','supplier')='walk_in' and nullif(seller_photo,'') is null then raise exception 'Walk-in seller photo required'; end if;
 if sid is null then
 if nullif(trim(p->>'supplier_name'),'') is null then raise exception 'Seller name required'; end if;
 if exists(select 1 from public.sellers where regexp_replace(cnic,'[^0-9]','','g')=seller_cnic) then
  if coalesce(p->>'seller_kind','supplier')='walk_in' then
   select id into sid from public.sellers where regexp_replace(cnic,'[^0-9]','','g')=seller_cnic limit 1;
   if (select seller_kind from public.sellers where id=sid)<>'walk_in' then raise exception 'This CNIC belongs to a registered supplier. Select that supplier'; end if;
   update public.sellers set full_name=trim(p->>'supplier_name'),mobile=seller_mobile,photo_url=coalesce(seller_photo,photo_url),seller_kind='walk_in' where id=sid;
  else raise exception 'CNIC already exists. Select the existing supplier'; end if;
 else
  insert into public.sellers(full_name,mobile,cnic,photo_url,seller_kind) values(trim(p->>'supplier_name'),seller_mobile,seller_cnic,seller_photo,coalesce(p->>'seller_kind','supplier')) returning id into sid;
 end if;
 else
 update public.sellers set mobile=seller_mobile,cnic=seller_cnic,photo_url=seller_photo where id=sid;
 end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,price,p->>'notes',auth.uid()) returning id into v;
 -- A buyback creates a new inventory lifecycle; prior purchases/invoices remain immutable.
 insert into public.inventory_items(purchase_id,stock_code,barcode_value,model,storage,color,imei_1,imei_2,serial_number,battery_health,pta_status,purchase_price,default_sale_price,condition_grade,warranty_notes,purchase_cost_pending,created_by)
 values(v,'','',trim(p->>'model'),p->>'storage',p->>'color',nullif(p->>'imei_1',''),nullif(p->>'imei_2',''),nullif(p->>'serial_number',''),nullif(p->>'battery_health','')::smallint,coalesce(p->>'pta_status','non_pta')::public.pta_status,price,nullif(p->>'sale_price','')::numeric,p->>'condition_grade',p->>'warranty_notes',nullif(p->>'purchase_price','') is null,auth.uid()) returning id into iid;
 insert into public.stock_movements(inventory_item_id,movement_type,to_status,reference_type,reference_id,created_by) values(iid,'purchase','in_stock','purchase',v,auth.uid());
 if price>0 then perform private.erp_post('purchase',v,'Phone purchase',jsonb_build_array(jsonb_build_object('account','1200','debit',price),jsonb_build_object('account','2000','credit',price))); end if;
 if paid>0 then
 insert into public.supplier_payments(purchase_id,amount,method,created_by) values(v,paid,method,auth.uid()) returning id into sid;
 perform private.erp_post('supplier_payment',sid,'Supplier payment',jsonb_build_array(jsonb_build_object('account','2000','debit',paid),jsonb_build_object('account',acc,'credit',paid)));
 end if;
 amt:=coalesce(nullif(p->>'expense_amount','')::numeric,0);
 if amt<0 or amt<>round(amt,2) then raise exception 'Invalid phone expense'; end if;
 if amt>0 then
 if nullif(trim(p->>'expense_description'),'') is null then raise exception 'Expense description required'; end if;
 insert into public.expenses(inventory_item_id,category,description,amount,method,created_by) values(iid,'Phone expense',p->>'expense_description',amt,method,auth.uid()) returning id into expense_id;
 perform private.erp_post('expense',expense_id,p->>'expense_description',jsonb_build_array(jsonb_build_object('account','5100','debit',amt),jsonb_build_object('account',acc,'credit',amt)));
 end if;
 elsif a='sale' then
 extras:=coalesce(p->'extras','[]'::jsonb);
 if jsonb_typeof(extras)<>'array' or jsonb_array_length(extras)>30 then raise exception 'Invalid accessory lines'; end if;
 extra_total:=0; cost:=0;
 for extra in select value from jsonb_array_elements(extras) loop
 extra_qty:=coalesce((extra->>'quantity')::integer,1); line_price:=coalesce(nullif(extra->>'price','')::numeric,0);
 if nullif(trim(extra->>'name'),'') is null or extra_qty<=0 or line_price<0 or line_price<>round(line_price,2) then raise exception 'Invalid accessory quantity or price'; end if;
 extra_total:=extra_total+extra_qty*line_price;
 end loop;
 price:=coalesce(nullif(p->>'price','')::numeric,0); discount:=coalesce((p->>'discount')::numeric,0); paid:=coalesce((p->>'paid')::numeric,0); total:=price+extra_total-discount;
 if nullif(p->>'inventory_id','') is not null then
 select * into item from public.inventory_items where id=(p->>'inventory_id')::uuid for update;
 if not found or item.status<>'in_stock' then raise exception 'Phone is no longer available'; end if;
 if item.purchase_cost_pending then raise exception 'Set purchase cost in Purchases before selling this phone'; end if;
 if price<=0 or discount>price then raise exception 'Invalid phone sale price or discount'; end if;
 cost:=item.purchase_price;
 elsif price<>0 or discount<>0 or jsonb_array_length(extras)=0 then raise exception 'Select a phone or add accessories'; end if;
 if total<=0 or price<0 or discount<0 or paid<0 or paid>total or price<>round(price,2) or discount<>round(discount,2) or paid<>round(paid,2) then raise exception 'Invalid sale amounts'; end if;
 sid:=nullif(p->>'customer_id','')::uuid;
 if sid is null then
 if nullif(trim(p->>'customer_name'),'') is null or coalesce(p->>'customer_mobile','') !~ '^[0-9]{11}$' then raise exception 'Customer name and 11-digit phone required'; end if;
 if coalesce(p->>'sale_kind','customer') not in ('customer','shopkeeper') then raise exception 'Invalid sale type'; end if;
 insert into public.customers(full_name,mobile,customer_kind) values(trim(p->>'customer_name'),p->>'customer_mobile',coalesce(p->>'sale_kind','customer')) returning id into sid;
 else
 if not exists(select 1 from public.customers where id=sid and nullif(trim(full_name),'') is not null and coalesce(mobile,'') ~ '^[0-9]{11}$' and customer_kind=coalesce(p->>'sale_kind','customer')) then raise exception 'Choose a customer with name and phone from the correct sale type'; end if;
 end if;
 if nullif(p->>'billed_by','') is null or not exists(select 1 from public.user_profiles u where u.id=(p->>'billed_by')::uuid and u.is_active) then raise exception 'Choose an active shopkeeper / staff member who made the bill'; end if;
 insert into public.sales(invoice_number,customer_id,subtotal,discount,final_total,payment_status,sold_by,billed_by,billed_by_name,sale_kind) values('AS-'||to_char(now() at time zone 'Asia/Karachi','YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,8)),sid,price+extra_total,discount,total,case when paid=total then 'paid'::public.payment_status when paid>0 then 'partial'::public.payment_status else 'unpaid'::public.payment_status end,auth.uid(),(p->>'billed_by')::uuid,(select u.full_name from public.user_profiles u where u.id=(p->>'billed_by')::uuid),coalesce(p->>'sale_kind','customer')) returning id into v;
 if item.id is not null then
 insert into public.sale_items(sale_id,inventory_item_id,item_name,unit_price,discount,final_price) values(v,item.id,item.model,price,discount,price-discount) returning id into iid;
 insert into public.sale_item_costs(sale_item_id,cost_price_snapshot) values(iid,item.purchase_price);
 update public.inventory_items set status='sold',sold_at=now() where id=item.id;
 insert into public.stock_movements(inventory_item_id,movement_type,from_status,to_status,reference_type,reference_id,created_by) values(item.id,'sale','in_stock','sold','sale',v,auth.uid());
 end if;
 for extra in select value from jsonb_array_elements(extras) order by value->>'accessory_id' loop
 extra_qty:=coalesce((extra->>'quantity')::integer,1); line_price:=coalesce(nullif(extra->>'price','')::numeric,0);
 if nullif(extra->>'accessory_id','') is not null then
 select * into stock from public.accessories where id=(extra->>'accessory_id')::uuid for update;
 if not found or stock.quantity<extra_qty then raise exception 'Insufficient accessory stock'; end if;
 update public.accessories set quantity=quantity-extra_qty,updated_at=now() where id=stock.id;
 insert into public.sale_items(sale_id,accessory_id,item_name,quantity,unit_price,discount,final_price,price_visible) values(v,stock.id,stock.name,extra_qty,line_price,0,line_price*extra_qty,nullif(extra->>'price','') is not null) returning id into iid;
 insert into public.sale_item_costs(sale_item_id,cost_price_snapshot) values(iid,stock.purchase_price*extra_qty);
 cost:=cost+stock.purchase_price*extra_qty;
 else
 insert into public.sale_items(sale_id,item_name,quantity,unit_price,discount,final_price,price_visible) values(v,trim(extra->>'name'),extra_qty,line_price,0,line_price*extra_qty,nullif(extra->>'price','') is not null);
 end if;
 end loop;
 perform private.erp_post('sale',v,'Invoice sale',jsonb_build_array(jsonb_build_object('account','1100','debit',total),jsonb_build_object('account','4000','credit',total),jsonb_build_object('account','5000','debit',cost),jsonb_build_object('account','1200','credit',cost)));
 if paid>0 then
 insert into public.payments(sale_id,amount,method,received_by) values(v,paid,method,auth.uid()) returning id into iid;
 perform private.erp_post('customer_payment',iid,'Sale receipt',jsonb_build_array(jsonb_build_object('account',acc,'debit',paid),jsonb_build_object('account','1100','credit',paid)));
 end if;
 elsif a='opening_receivable' then
 if amt<=0 then raise exception 'Positive opening balance required'; end if;
 sid:=nullif(p->>'customer_id','')::uuid;
 if sid is null then
 if nullif(trim(p->>'full_name'),'') is null or coalesce(p->>'mobile','') !~ '^[0-9]{11}$' then raise exception 'Name and 11-digit phone required'; end if;
 if coalesce(p->>'customer_kind','customer') not in ('customer','shopkeeper') then raise exception 'Invalid contact type'; end if;
 insert into public.customers(full_name,mobile,customer_kind,notes) values(trim(p->>'full_name'),p->>'mobile',coalesce(p->>'customer_kind','customer'),p->>'notes') returning id into sid;
 elsif not exists(select 1 from public.customers where id=sid) then raise exception 'Customer not found'; end if;
 if nullif(p->>'record_date','') is null or (p->>'record_date')::date>(now() at time zone 'Asia/Karachi')::date then raise exception 'Past or current record date required'; end if;
 if nullif(trim(p->>'reference'),'') is null then raise exception 'Old record reference required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
 if exists(select 1 from public.sales where customer_id=sid and is_opening_balance and opening_reference=trim(p->>'reference')) then raise exception 'This old reference already exists for the customer'; end if;
 insert into public.sales(invoice_number,customer_id,subtotal,discount,final_total,payment_status,sold_by,sale_date,is_opening_balance,opening_reference) values('OPEN-'||upper(substr(gen_random_uuid()::text,1,12)),sid,amt,0,amt,'unpaid',auth.uid(),((p->>'record_date')::date::timestamp at time zone 'Asia/Karachi'),true,trim(p->>'reference')) returning id into v;
 perform private.erp_post('opening_receivable',v,'Opening receivable: '||trim(p->>'reference'),jsonb_build_array(jsonb_build_object('account','1100','debit',amt),jsonb_build_object('account','3000','credit',amt)));
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
 if sid is not null and not exists(select 1 from public.sellers where id=sid and seller_kind='accessory_supplier') then raise exception 'Choose an accessory supplier'; end if;
 if sid is null then
 if nullif(trim(p->>'supplier_name'),'') is null then raise exception 'Accessory supplier required'; end if;
 insert into public.sellers(full_name,seller_kind) values(trim(p->>'supplier_name'),'accessory_supplier') returning id into sid;
 end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,total,p->>'notes',auth.uid()) returning id into v;
 insert into public.accessories(name,category,sku,quantity,purchase_price,sale_price,supplier_id,purchase_id,notes,created_by) values(trim(p->>'name'),coalesce(nullif(p->>'category',''),'Other'),'ACC-'||upper(substr(gen_random_uuid()::text,1,8)),qty,price,nullif(p->>'sale_price','')::numeric,sid,v,p->>'notes',auth.uid()) returning id into iid;
 if total>0 then perform private.erp_post('purchase',v,'Accessory purchase',jsonb_build_array(jsonb_build_object('account','1200','debit',total),jsonb_build_object('account','2000','credit',total))); end if;
 if paid>0 then
 insert into public.supplier_payments(purchase_id,amount,method,created_by) values(v,paid,method,auth.uid()) returning id into sid;
 perform private.erp_post('supplier_payment',sid,'Accessory purchase payment',jsonb_build_array(jsonb_build_object('account','2000','debit',paid),jsonb_build_object('account',acc,'credit',paid)));
 end if;
 elsif a='accessory_restock' then
 v:=(p->>'accessory_id')::uuid; qty:=(p->>'quantity')::integer; price:=(p->>'purchase_price')::numeric; paid:=coalesce((p->>'paid')::numeric,0);
 select * into stock from public.accessories where id=v for update;
 if not found then raise exception 'Accessory not found'; end if;
 if qty is null or qty<=0 or price is null or price<0 or price<>round(price,2) then raise exception 'Valid quantity and unit cost required'; end if;
 total:=price*qty; if paid<0 or paid>total or paid<>round(paid,2) then raise exception 'Invalid purchase payment'; end if;
 sid:=nullif(p->>'supplier_id','')::uuid;
 if sid is null then if nullif(trim(p->>'supplier_name'),'') is null then raise exception 'Accessory supplier required'; end if; insert into public.sellers(full_name,seller_kind) values(trim(p->>'supplier_name'),'accessory_supplier') returning id into sid;
 elsif not exists(select 1 from public.sellers where id=sid and seller_kind='accessory_supplier') then raise exception 'Choose an accessory supplier'; end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,total,p->>'notes',auth.uid()) returning id into iid;
 update public.accessories set purchase_price=round(((quantity*purchase_price)+(qty*price))/(quantity+qty),2),quantity=quantity+qty,supplier_id=sid,purchase_id=iid,sale_price=coalesce(nullif(p->>'sale_price','')::numeric,sale_price),updated_at=now() where id=v;
 if total>0 then perform private.erp_post('purchase',iid,'Accessory restock',jsonb_build_array(jsonb_build_object('account','1200','debit',total),jsonb_build_object('account','2000','credit',total))); end if;
 if paid>0 then insert into public.supplier_payments(purchase_id,amount,method,created_by) values(iid,paid,method,auth.uid()) returning id into sid; perform private.erp_post('supplier_payment',sid,'Accessory restock payment',jsonb_build_array(jsonb_build_object('account','2000','debit',paid),jsonb_build_object('account',acc,'credit',paid))); end if;
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
 update public.inventory_items set purchase_cost_pending=case when nullif(p->>'purchase_price','') is not null then false else purchase_cost_pending end,status=(p->>'status')::public.inventory_status,default_sale_price=nullif(p->>'sale_price','')::numeric,battery_health=nullif(p->>'battery_health','')::smallint,color=p->>'color',condition_grade=p->>'condition_grade',warranty_notes=p->>'warranty_notes',public_notes=p->>'public_notes' where id=v;
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
