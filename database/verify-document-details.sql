-- Document/supplier fixtures are isolated and rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
set local role authenticated;
do $test$
declare phone jsonb; accessory jsonb; restock jsonb; invoice jsonb; base jsonb; vendor uuid; other_vendor uuid; a_id uuid; req uuid:=gen_random_uuid(); before_sellers bigint; snapshot jsonb; stock_sku text;
begin
 base:=jsonb_build_object('action','accessory_purchase','request_id',gen_random_uuid(),'name','Document test cable','quantity',100,'purchase_price',100,'paid',30,'method','bank_transfer');
 begin
  perform public.erp_action(base);raise exception 'Missing accessory supplier accepted';
 exception when others then if sqlerrm<>'Accessory supplier required' then raise; end if; end;
 accessory:=public.erp_action(base||jsonb_build_object('supplier_name','Document original supplier'));
 a_id:=(accessory->>'inventory_id')::uuid;
 select supplier_id,sku into vendor,stock_sku from public.accessories where id=a_id;
 if not exists(select 1 from public.purchases where id=(accessory->>'id')::uuid and (item_details->0->>'quantity')::int=100 and (item_details->0->>'purchase_price')::numeric=100 and item_details->0->>'sku'=stock_sku) then raise exception 'Original accessory purchase snapshot missing'; end if;
 select count(*) into before_sellers from public.sellers;
 restock:=public.erp_action(jsonb_build_object('action','accessory_restock','request_id',req,'accessory_id',a_id,'quantity',20,'paid',0,'supplier_name','Must not create this supplier','supplier_id',gen_random_uuid()));
 if public.erp_action(jsonb_build_object('action','accessory_restock','request_id',req))<>restock then raise exception 'Restock retry not deduplicated'; end if;
 if (select count(*) from public.sellers)<>before_sellers then raise exception 'Restock created another supplier'; end if;
 if not exists(select 1 from public.accessories where id=a_id and quantity=120 and purchase_price=100 and supplier_id=vendor and sku=stock_sku) then raise exception 'Existing supplier/cost/barcode changed'; end if;
 if not exists(select 1 from public.purchases where id=(restock->>'inventory_id')::uuid and seller_id=vendor and total_amount=2000 and (item_details->0->>'quantity')::int=20 and item_details->0->>'sku'=stock_sku) then raise exception 'Restock purchase supplier or snapshot incorrect'; end if;
 if not exists(select 1 from public.purchases where id=(accessory->>'id')::uuid and (item_details->0->>'quantity')::int=100) then raise exception 'Restock rewrote original purchase snapshot'; end if;
 phone:=public.erp_action(jsonb_build_object('action','purchase','request_id',gen_random_uuid(),'supplier_name','Document test seller','seller_kind','supplier','photo_url','test/private-seller.jpg','model','Document iPhone','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'storage','128GB','pta_status','non_pta','purchase_price',1000,'paid',1000,'method','cash','color','Blue','condition_grade','Used - 10/10','warranty_notes','Check warranty'));
 if not exists(select 1 from public.purchases where id=(phone->>'id')::uuid and item_details->0->>'color'='Blue' and item_details->0->>'condition_grade'='Used - 10/10' and not (item_details->0 ? 'battery_health')) then raise exception 'Phone purchase snapshot omitted supplied fields or invented health'; end if;
 invoice:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',phone->>'inventory_id','price',1200,'paid',500,'method','bank_transfer','customer_name','Document customer','customer_mobile','03000000008','billed_by_name','Typed bill maker','extras',jsonb_build_array(jsonb_build_object('accessory_id',a_id,'name','Document test cable','quantity',1,'price',0))));
 if not exists(select 1 from public.sale_items where sale_id=(invoice->>'id')::uuid and phone_details->>'color'='Blue' and phone_details->>'warranty_notes'='Check warranty' and not (phone_details ? 'battery_health')) then raise exception 'Invoice snapshot fields missing'; end if;
 if not exists(select 1 from public.payments where sale_id=(invoice->>'id')::uuid and method='bank_transfer' and amount=500) then raise exception 'Sale payment method not saved'; end if;
 if not exists(select 1 from public.supplier_payments where purchase_id=(phone->>'id')::uuid and method='cash' and amount=1000) then raise exception 'Purchase payment method not saved'; end if;
 snapshot:=public.erp_read();
 if not exists(select 1 from jsonb_array_elements(snapshot->'purchases') p where p->>'id'=accessory->>'id' and (p->'item_details'->0->>'quantity')::int=100) then raise exception 'Purchase snapshot missing from read API'; end if;
 if not exists(select 1 from jsonb_array_elements(snapshot->'invoiceProfits') p where p->>'sale_id'=invoice->>'id' and (p->>'gross_profit')::numeric=100) then raise exception 'Free cable profit changed'; end if;
 if exists(select 1 from public.erp_journal_lines group by journal_id having sum(debit-credit)<>0) then raise exception 'Unbalanced journal'; end if;
end $test$;
rollback;
