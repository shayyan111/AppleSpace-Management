-- Fixtures, payments and journals are entirely rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
set local role authenticated;
do $test$
declare today date:=(now() at time zone 'Asia/Karachi')::date; kind text; category text; field text; mode text; base jsonb; r jsonb; phone jsonb; accessory jsonb; invoice jsonb; req uuid; stock public.accessories; cost numeric; store jsonb;
begin
 foreach kind in array array['receivable','payable'] loop
  foreach mode in array array['missing','blank'] loop
   base:=jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'kind',kind,'category','existing_balance','full_name','Optional description test','record_date',today,'amount',100);
   if mode='blank' then base:=base||jsonb_build_object('description',''); end if;
   r:=public.erp_action(base);
   if not exists(select 1 from public.erp_ledger_entries where id=(r->>'id')::uuid and description='') then raise exception 'Optional ledger description failed'; end if;
  end loop;
 end loop;
 foreach category in array array['Rent','Utilities','Salaries','Marketing','Transport','Repairs'] loop
  perform public.erp_action(jsonb_build_object('action','expense','request_id',gen_random_uuid(),'category',category,'amount',10));
 end loop;
 foreach category in array array['Other','Others','Other phone expense'] loop
  begin
   perform public.erp_action(jsonb_build_object('action','expense','request_id',gen_random_uuid(),'category',category,'amount',10));raise exception 'Other expense accepted blank description';
  exception when others then if sqlerrm<>'Description required for Other expenses' then raise; end if; end;
 end loop;
 perform public.erp_action(jsonb_build_object('action','expense','request_id',gen_random_uuid(),'category','Other','description','Tea','amount',10));
 base:=jsonb_build_object('action','purchase','storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_name','Invoice field test','model','iPhone invoice test','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'battery_health',91,'purchase_price',1000);
 foreach mode in array array['missing','blank'] loop
  begin
   perform public.erp_action(case when mode='blank' then base||jsonb_build_object('paid','') else base end);raise exception 'Paid now was not required';
  exception when others then if sqlerrm<>'Paid now required; enter 0 for an unpaid purchase' then raise; end if; end;
 end loop;
 phone:=public.erp_action(base||jsonb_build_object('paid',0));
 perform public.erp_action(jsonb_build_object('action','phone_expense','request_id',gen_random_uuid(),'inventory_id',phone->>'inventory_id','category','Parts','amount',10));
 accessory:=public.erp_action(jsonb_build_object('action','accessory_purchase','request_id',gen_random_uuid(),'supplier_name','Accessory test supplier','name','Cable','category','Cable','quantity',4,'purchase_price',100,'paid',0));
 select * into stock from public.accessories where id=(accessory->>'inventory_id')::uuid;
 req:=gen_random_uuid();
 r:=public.erp_action(jsonb_build_object('action','accessory_restock','request_id',req,'accessory_id',stock.id,'supplier_id',stock.supplier_id,'quantity',100,'paid',0));
 if public.erp_action(jsonb_build_object('action','accessory_restock','request_id',req))<>r then raise exception 'Restock retry was not deduplicated'; end if;
 if not exists(select 1 from public.accessories where id=stock.id and quantity=104 and purchase_price=100 and sku=stock.sku) then raise exception 'Stored-cost restock changed cost or SKU'; end if;
 if not exists(select 1 from public.purchases where id=(r->>'inventory_id')::uuid and total_amount=10000) then raise exception 'Stored cost not used in purchase accounting'; end if;
 if not exists(select 1 from public.erp_journals j join public.erp_journal_lines l on l.journal_id=j.id where j.source_id=(r->>'inventory_id')::uuid and l.account_code='1200' and l.debit=10000) then raise exception 'Restock accounting incorrect'; end if;
 base:=jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',phone->>'inventory_id','price',1200,'paid',1200,'customer_name','Invoice details test','customer_mobile','03000000005','billed_by_name','Free text billing person','extras',jsonb_build_array(jsonb_build_object('accessory_id',stock.id,'name','Cable','quantity',1,'price',0)));
 begin
  perform public.erp_action(base||jsonb_build_object('billed_by_name',' '));raise exception 'Blank billing name accepted';
 exception when others then if sqlerrm<>'Enter the name of the person who made the bill (up to 120 characters)' then raise; end if; end;
 invoice:=public.erp_action(base);
 if not exists(select 1 from public.sales where id=(invoice->>'id')::uuid and billed_by_name='Free text billing person' and billed_by=auth.uid() and sold_by=auth.uid()) then raise exception 'Free text billing name or audit actor incorrect'; end if;
 if not exists(select 1 from public.sale_items s join public.inventory_items i on i.id=s.inventory_item_id where s.sale_id=(invoice->>'id')::uuid and s.phone_details->>'imei_1'=i.imei_1 and s.phone_details->>'pta_status'='non_pta' and s.phone_details->>'storage'='128GB' and (s.phone_details->>'battery_health')::int=91) then raise exception 'Invoice phone details were not captured'; end if;
 store:=public.erp_read();
 if not exists(select 1 from jsonb_array_elements(store->'saleItems') s where s->>'sale_id'=invoice->>'id' and s->'phone_details'->>'model'='iPhone invoice test') then raise exception 'Invoice details not returned through API'; end if;
 if not exists(select 1 from jsonb_array_elements(store->'invoiceProfits') p where p->>'sale_id'=invoice->>'id' and (p->>'gross_profit')::numeric=100) then raise exception 'Free accessory profit incorrect'; end if;
 if exists(select 1 from public.erp_journal_lines group by journal_id having sum(debit-credit)<>0) then raise exception 'Unbalanced journal'; end if;
end $test$;
reset role;
-- Editing the linked phone later must not alter recorded invoice details.
update public.inventory_items set pta_status='pta_approved',battery_health=80 where model='iPhone invoice test';
do $$ begin
 if not exists(select 1 from public.sale_items where phone_details->>'model'='iPhone invoice test' and phone_details->>'pta_status'='non_pta' and (phone_details->>'battery_health')::int=91) then raise exception 'Invoice snapshot changed after stock edit'; end if;
end $$;
rollback;
