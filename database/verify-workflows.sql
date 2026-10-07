-- Run in a SQL editor after V5 and V6. Every test transaction is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
set local role authenticated;
do $$
declare
 p jsonb; retry jsonb; s jsonb; buyback jsonb; resold jsonb; accessory jsonb; legacy jsonb;
 owner_id uuid:=auth.uid(); walkin jsonb; store jsonb; first_id uuid; second_id uuid; vendor uuid; accessory_id uuid;
 imei text:=floor(100000000000000+random()*800000000000000)::bigint::text;
 second_imei text:=floor(100000000000000+random()*800000000000000)::bigint::text;
 cnic text:=floor(1000000000000+random()*8000000000000)::bigint::text;
 req uuid:=gen_random_uuid(); customer_id uuid; original_purchase uuid;
begin
 p:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',req,'supplier_name','Workflow test supplier','seller_kind','supplier','cnic',cnic,'mobile','03000000000','model','Workflow first phone','imei_1',imei,'imei_2',second_imei,'purchase_price',100000,'sale_price',120000,'paid',50000));
 first_id:=(p->>'inventory_id')::uuid;original_purchase:=(p->>'id')::uuid;
 walkin:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_name','Workflow walk-in seller','seller_kind','walk_in','cnic',floor(1000000000000+random()*8000000000000)::bigint::text,'mobile','03000000003','photo_url','verification/photo.jpg','model','Workflow required cost phone','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'purchase_price',100,'paid',0));
 store:=public.erp_read();
 if exists(select 1 from jsonb_array_elements(store->'suppliers') x where x->>'seller_kind'='walk_in') then raise exception 'Walk-in contact entered supplier directory'; end if;
 if not exists(select 1 from public.inventory_items where id=(walkin->>'inventory_id')::uuid and not purchase_cost_pending) then raise exception 'Required purchase cost missing'; end if;
 if not exists(select 1 from jsonb_array_elements(store->'walkInSellers') x where x->>'full_name'='Workflow walk-in seller') then raise exception 'Walk-in purchase contact missing'; end if;
 if first_id is null then raise exception 'Purchase missing inventory ID'; end if;
 retry:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',req));
 if retry<>p then raise exception 'Purchase retry was not deduplicated'; end if;
 begin
   perform public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_name','Duplicate','cnic',cnic,'mobile','03000000000','model','Duplicate phone','imei_1',second_imei,'purchase_price',100));
   raise exception 'Active cross-IMEI duplicate accepted';
 exception when others then
   if sqlerrm<>'IMEI or serial already exists in active inventory' then raise; end if;
 end;
 perform public.erp_action(jsonb_build_object('action','website','request_id',gen_random_uuid(),'inventory_id',first_id,'visible',true,'price',120000));
 begin
   perform public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',first_id,'price',120000,'customer_name','Missing phone','customer_mobile','','billed_by',owner_id));
   raise exception 'Sale without customer phone accepted';
 exception when others then
   if sqlerrm<>'Customer name and 11-digit phone required' then raise; end if;
 end;
 s:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',first_id,'price',120000,'discount',5000,'paid',25000,'sale_kind','shopkeeper','customer_name','Workflow test shopkeeper','customer_mobile','03000000001','billed_by',owner_id));
 if not exists(select 1 from public.sales where id=(s->>'id')::uuid and sale_kind='shopkeeper' and billed_by=owner_id and billed_by_name is not null) then raise exception 'Shopkeeper sale or bill maker missing'; end if;
 if exists(select 1 from public.website_catalog where inventory_item_id=first_id) then raise exception 'Sold phone still public'; end if;
 if not exists(select 1 from jsonb_array_elements(public.erp_sold_phones()) x where x->>'original_inventory_id'=first_id::text and (x->>'sale_price')::numeric=115000) then raise exception 'Sold archive missing actual sale amount'; end if;
 select sale.customer_id into customer_id from public.sales sale where sale.id=(s->>'id')::uuid;
 buyback:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_id',(select seller_id from public.purchases where id=original_purchase),'seller_kind','supplier','model','Workflow second phone','imei_1',imei,'imei_2',second_imei,'purchase_price',90000,'sale_price',110000,'paid',0));
 second_id:=(buyback->>'inventory_id')::uuid;
 if second_id=first_id then raise exception 'Buyback reused historical inventory row'; end if;
 if not exists(select 1 from public.inventory_items where id=first_id and status='sold' and purchase_id=original_purchase and purchase_price=100000 and model='Workflow first phone') then raise exception 'Buyback modified original purchase history'; end if;
 resold:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',second_id,'price',110000,'paid',110000,'sale_kind','shopkeeper','customer_id',customer_id,'billed_by',owner_id));
 if (select count(*) from jsonb_array_elements(public.erp_sold_phones()) x where x->>'imei_1'=imei)<>2 then raise exception 'Repeat sale lost an archived lifecycle'; end if;
 if (select cost_price_snapshot from public.sale_item_costs c join public.sale_items i on i.id=c.sale_item_id where i.sale_id=(s->>'id')::uuid)<>100000 then raise exception 'Original profit snapshot changed'; end if;
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',s->>'id','amount',90000));
 vendor:=(public.erp_action(jsonb_build_object('action','supplier','request_id',gen_random_uuid(),'seller_kind','accessory_supplier','full_name','Workflow accessory supplier'))->>'id')::uuid;
 accessory:=public.erp_action(jsonb_build_object('action','accessory_purchase','request_id',gen_random_uuid(),'supplier_id',vendor,'name','Workflow cable','purchase_price',100,'sale_price',300,'quantity',3,'paid',100));
 accessory_id:=(accessory->>'inventory_id')::uuid;
 perform public.erp_action(jsonb_build_object('action','accessory_restock','request_id',gen_random_uuid(),'accessory_id',accessory_id,'supplier_id',vendor,'quantity',2,'paid',0));
 if not exists(select 1 from public.accessories where id=accessory_id and quantity=5 and purchase_price=100) then raise exception 'Accessory restock at saved cost failed'; end if;
 perform public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'sale_kind','shopkeeper','customer_id',customer_id,'billed_by',owner_id,'paid',600,'extras',jsonb_build_array(jsonb_build_object('accessory_id',accessory_id,'name','Workflow cable','quantity',2,'price',300))));
 if (select quantity from public.accessories where id=accessory_id)<>3 then raise exception 'Accessory sale did not reduce quantity'; end if;
 legacy:=public.erp_action(jsonb_build_object('action','opening_receivable','request_id',gen_random_uuid(),'customer_id',customer_id,'record_date',(now() at time zone 'Asia/Karachi')::date,'reference',gen_random_uuid()::text,'amount',7000));
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',legacy->>'id','amount',2000));
 if not exists(select 1 from public.sales where id=(legacy->>'id')::uuid and is_opening_balance and payment_status='partial') then raise exception 'Legacy balance settlement failed'; end if;
 if (select coalesce(sum(debit-credit),0) from public.erp_journal_lines)<>0 then raise exception 'Accounting journals do not balance'; end if;
end $$;
reset role;
update public.user_profiles set role='salesperson' where id=auth.uid();
set local role authenticated;
do $$
declare store jsonb:=public.erp_read();
begin
 if store ? 'costs' or store ? 'journals' or store ? 'accounts' then raise exception 'Restricted financial data leaked'; end if;
 if exists(select 1 from jsonb_array_elements(store->'inventory') x where x ? 'purchase_price') then raise exception 'Staff inventory cost leaked'; end if;
 if exists(select 1 from jsonb_array_elements(public.erp_sold_phones()) x where x ? 'purchase_price') then raise exception 'Staff sold-phone cost leaked'; end if;
 begin
  perform public.erp_action(jsonb_build_object('action','accessory_restock','request_id',gen_random_uuid()));
  raise exception 'Staff restock permitted';
 exception when others then if sqlerrm<>'Manager access required' then raise; end if; end;
end $$;
reset role;
update public.user_profiles set role='manager' where id=auth.uid();
set local role authenticated;
do $$ declare store jsonb:=public.erp_read(); begin
 if store ? 'costs' or store ? 'journals' or store ? 'accounts' then raise exception 'Manager received owner reports'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.erp_sold_phones()','EXECUTE') then raise exception 'Anonymous archive RPC access permitted'; end if;
end $$;
rollback;
