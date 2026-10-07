-- Owner transaction smoke test. Every test record is rolled back.
begin;
select set_config('request.jwt.claim.sub','2ae01632-c454-4da4-a10d-aaab05b5c484',true);
set local role authenticated;
do $$
declare day_session jsonb; p jsonb; p2 jsonb; s jsonb; c jsonb; i uuid; sid uuid; req uuid:=gen_random_uuid(); journal_balance numeric; begin
 day_session:=public.erp_action(jsonb_build_object('action','open_day','request_id',gen_random_uuid(),'amount',150000));
 c:=public.erp_action(jsonb_build_object('action','customer','request_id',gen_random_uuid(),'full_name','ERP smoke test customer','mobile','03000000000'));
 p:=public.erp_action(jsonb_build_object('action','purchase','cnic','9999999999999','mobile','03000000000','photo_url','verification/photo.jpg','request_id',req,'supplier_name','ERP smoke test supplier','model','ERP test phone','imei_1','999999999999991','pta_status','non_pta','purchase_price',100000,'sale_price',120000,'paid',50000,'method','cash'));
 p2:=public.erp_action(jsonb_build_object('action','purchase','cnic','9999999999999','mobile','03000000000','photo_url','verification/photo.jpg','request_id',req,'supplier_name','ERP smoke test supplier','model','ERP test phone','imei_1','999999999999991','purchase_price',100000,'paid',50000));
 if p<>p2 then raise exception 'Idempotency failed'; end if;
 i:=(p->>'inventory_id')::uuid;
 perform public.erp_action(jsonb_build_object('action','website','request_id',gen_random_uuid(),'inventory_id',i,'visible',true,'price',120000));
 if not exists(select 1 from public.website_catalog where inventory_item_id=i) then raise exception 'Website sync failed'; end if;
 s:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',i,'customer_name','Invoice test','customer_mobile','03000000001','extras',jsonb_build_array(jsonb_build_object('name','Cover','quantity',1,'price','')),'price',120000,'discount',5000,'paid',25000,'method','cash'));
 sid:=(s->>'id')::uuid;
 if exists(select 1 from public.website_catalog where inventory_item_id=i) then raise exception 'Sold phone remains on website'; end if;
 if (select status from public.inventory_items where id=i)<>'sold' then raise exception 'Stock state failed'; end if;
 begin
 perform public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',i,'price',120000,'paid',120000));
 raise exception 'Double sale was permitted';
 exception when others then if sqlerrm='Double sale was permitted' then raise; end if; end;
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',sid,'amount',90000,'method','bank_transfer'));
 if (select payment_status from public.sales where id=sid)<>'paid' then raise exception 'Payment status failed'; end if;
 begin
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',sid,'amount',1));
 raise exception 'Overpayment was permitted';
 exception when others then if sqlerrm='Overpayment was permitted' then raise; end if; end;
 perform public.erp_action(jsonb_build_object('action','supplier_payment','request_id',gen_random_uuid(),'purchase_id',p->>'id','amount',50000));
 perform public.erp_action(jsonb_build_object('action','expense','request_id',gen_random_uuid(),'category','Test','description','Smoke expense','amount',1000));
 perform public.erp_action(jsonb_build_object('action','close_day','request_id',gen_random_uuid(),'session_id',day_session->>'id','amount',74000));
 if (select variance from public.daily_sessions where id=(day_session->>'id')::uuid)<>0 then raise exception 'Daily closing variance failed'; end if;
 select sum(debit-credit) into journal_balance from public.erp_journal_lines;
 if journal_balance<>0 then raise exception 'Journal out of balance'; end if;
 if (select final_price-cost_price_snapshot from public.sale_items si join public.sale_item_costs sc on sc.sale_item_id=si.id where si.sale_id=sid)<>15000 then raise exception 'Profit snapshot failed'; end if;
end $$;
rollback;
