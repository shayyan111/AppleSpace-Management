begin;
select set_config('request.jwt.claim.sub','2ae01632-c454-4da4-a10d-aaab05b5c484',true);
set local role authenticated;
do $$
declare p jsonb; ap jsonb; i uuid; supplier uuid; begin
p:=public.erp_action(jsonb_build_object('action','purchase','cnic','9999999999999','mobile','03000000000','photo_url','verification/photo.jpg','request_id',gen_random_uuid(),'supplier_name','Batch verification','model','Batch phone','imei_1','999999999999992','pta_status','non_pta','purchase_price','','sale_price',1500,'paid',0));
i:=(p->>'inventory_id')::uuid;
if not (select purchase_cost_pending from public.inventory_items where id=i) then raise exception 'Pending cost failed'; end if;
select seller_id into supplier from public.purchases where id=(p->>'id')::uuid;
perform public.erp_action(jsonb_build_object('action','inventory_edit','request_id',gen_random_uuid(),'inventory_id',i,'status','in_stock','purchase_price',1200,'sale_price',1600));
if (select purchase_cost_pending from public.inventory_items where id=i) then raise exception 'Cost did not resolve'; end if;
if (select total_amount from public.purchases where id=(p->>'id')::uuid)<>1200 then raise exception 'Cost correction failed'; end if;
perform public.erp_action(jsonb_build_object('action','repair','request_id',gen_random_uuid(),'inventory_id',i,'repairing',true));
if (select status from public.inventory_items where id=i)<>'repair' then raise exception 'Repair failed'; end if;
perform public.erp_action(jsonb_build_object('action','repair','request_id',gen_random_uuid(),'inventory_id',i,'repairing',false));
perform public.erp_action(jsonb_build_object('action','phone_expense','request_id',gen_random_uuid(),'inventory_id',i,'amount',100,'description','Repair verification'));
if not exists(select 1 from public.expenses where inventory_item_id=i and amount=100) then raise exception 'Phone expense failed'; end if;
ap:=public.erp_action(jsonb_build_object('action','accessory_purchase','request_id',gen_random_uuid(),'name','Batch cable','quantity',3,'purchase_price',100,'sale_price',200,'supplier_id',supplier,'paid',0));
if not exists(select 1 from public.accessories where purchase_id=(ap->>'id')::uuid and quantity=3) then raise exception 'Accessory failed'; end if;
perform public.erp_action(jsonb_build_object('action','supplier_payment_bulk','request_id',gen_random_uuid(),'supplier_id',supplier,'amount',1200));
if (select sum(amount) from public.supplier_payments where purchase_id in ((p->>'id')::uuid,(ap->>'id')::uuid))<>1200 then raise exception 'Payment allocation failed'; end if;
begin
perform public.erp_action(jsonb_build_object('action','supplier_payment_bulk','request_id',gen_random_uuid(),'supplier_id',supplier,'amount',301));
raise exception 'Overpayment accepted';
exception when others then if sqlerrm='Overpayment accepted' then raise; end if; end;
begin
perform public.erp_action(jsonb_build_object('action','inventory_edit','request_id',gen_random_uuid(),'inventory_id',i,'status','in_stock','purchase_price',100,'sale_price',1600));
raise exception 'Paid cost reduction accepted';
exception when others then if sqlerrm='Paid cost reduction accepted' then raise; end if; end;
begin
perform public.erp_action(jsonb_build_object('action','purchase','request_id',gen_random_uuid(),'supplier_name','Duplicate','cnic','9999999999999','mobile','03000000000','photo_url','verification/photo.jpg','model','Duplicate','imei_1','999999999999993'));
raise exception 'Duplicate CNIC accepted';
exception when others then if sqlerrm='Duplicate CNIC accepted' then raise; end if; end;
begin
perform public.erp_action(jsonb_build_object('action','purchase','request_id',gen_random_uuid(),'supplier_name','Invalid','cnic','123','mobile','03000000000','photo_url','verification/photo.jpg','model','Invalid','imei_1','999999999999993'));
raise exception 'Invalid CNIC accepted';
exception when others then if sqlerrm='Invalid CNIC accepted' then raise; end if; end;
if exists(select 1 from public.erp_journal_lines group by journal_id having sum(debit-credit)<>0) then raise exception 'Unbalanced accounting'; end if;
end $$;
rollback;
