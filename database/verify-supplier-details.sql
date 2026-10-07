-- All fixtures and payments roll back. Run after supplier_optional_details.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
set local role authenticated;
do $$
<<supplier_test>>
declare p jsonb; p2 jsonb; s jsonb; legacy jsonb; seller_id uuid; customer_id uuid; req uuid:=gen_random_uuid();
 cnic text:=floor(1000000000000+random()*8000000000000)::bigint::text;
 imei text:=floor(100000000000000+random()*800000000000000)::bigint::text; base jsonb; mode text;
begin
 base:=jsonb_build_object('action','purchase','storage','128GB','pta_status','non_pta','seller_kind','supplier','supplier_name','Name-only supplier test','model','Test iPhone','imei_1',imei,'purchase_price',100,'paid',40);
 p:=public.erp_action(base||jsonb_build_object('request_id',req));
 select purchase_row.seller_id into seller_id from public.purchases purchase_row where id=(p->>'id')::uuid;
 if not exists(select 1 from public.sellers t where t.id=supplier_test.seller_id and t.full_name='Name-only supplier test' and t.cnic is null and t.mobile is null and t.photo_url is null) then raise exception 'Name-only supplier purchase failed'; end if;
 if (select total_amount from public.purchases where id=(p->>'id')::uuid)-(select sum(amount) from public.supplier_payments where purchase_id=(p->>'id')::uuid)<>60 then raise exception 'Payable incorrect'; end if;
 p2:=public.erp_action(jsonb_build_object('action','purchase','storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'seller_kind','supplier','supplier_id',seller_id,'mobile','','cnic','','model','Another test iPhone','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'purchase_price',100,'paid',0));
 if public.erp_action(base||jsonb_build_object('request_id',req))<>p then raise exception 'Purchase retry not idempotent'; end if;
 -- Multiple new suppliers with blank optional details must not collide on CNIC uniqueness.
 perform public.erp_action((base-'imei_1')||jsonb_build_object('request_id',gen_random_uuid(),'supplier_name','Second name-only supplier','cnic',' ','mobile',' ','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text));
 p2:=public.erp_action((base-'imei_1')||jsonb_build_object('request_id',gen_random_uuid(),'supplier_name','Complete supplier','cnic',cnic,'mobile','03000000002','photo_url','verification/supplier.jpg','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text));
 select purchase_row.seller_id into seller_id from public.purchases purchase_row where id=(p2->>'id')::uuid;
 perform public.erp_action((base-'imei_1'-'supplier_name')||jsonb_build_object('request_id',gen_random_uuid(),'supplier_id',seller_id,'cnic','','mobile','','photo_url','','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text));
 if not exists(select 1 from public.sellers t where t.id=supplier_test.seller_id and t.cnic=supplier_test.cnic and t.mobile='03000000002' and t.photo_url='verification/supplier.jpg') then raise exception 'Blank optional details erased existing supplier'; end if;
 foreach mode in array array['name','cnic','mobile','walk_in_cnic','walk_in_mobile','walk_in_photo'] loop
  begin
   perform public.erp_action((base-'imei_1')||jsonb_build_object('request_id',gen_random_uuid(),'supplier_name',case when mode='name' then '' else 'Validation test' end,'seller_kind',case when mode like 'walk_in_%' then 'walk_in' else 'supplier' end,'cnic',case when mode='cnic' then '12' when mode='walk_in_cnic' then '' when mode like 'walk_in_%' then floor(1000000000000+random()*8000000000000)::bigint::text else null end,'mobile',case when mode='mobile' then '12' when mode='walk_in_mobile' then '' when mode like 'walk_in_%' then '03000000003' else null end,'photo_url',case when mode='walk_in_photo' then null else 'verification/walkin.jpg' end,'imei_1',floor(100000000000000+random()*800000000000000)::bigint::text));
   raise exception 'Invalid seller details accepted: %',mode;
  exception when others then
   if sqlerrm<>(case when mode='name' then 'Seller name required' when mode in ('cnic','walk_in_cnic') then 'Seller CNIC must contain 13 digits' when mode in ('mobile','walk_in_mobile') then 'Seller mobile must contain 11 digits' else 'Walk-in seller photo required' end) then raise; end if;
  end;
 end loop;
 -- Settlement preserves invoice and contact; projection into the outstanding view is UI-derived.
 s:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',p->>'inventory_id','price',200,'paid',50,'customer_name','Settlement test','customer_mobile','03000000004','billed_by',auth.uid()));
 select sale.customer_id into customer_id from public.sales sale where id=(s->>'id')::uuid;
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',s->>'id','amount',150));
 if not exists(select 1 from public.sales where id=(s->>'id')::uuid and payment_status='paid') or not exists(select 1 from public.customers where id=supplier_test.customer_id) then raise exception 'Settlement lost invoice or marketing contact'; end if;
 legacy:=public.erp_action(jsonb_build_object('action','opening_receivable','request_id',gen_random_uuid(),'customer_id',customer_id,'record_date',(now() at time zone 'Asia/Karachi')::date,'reference',gen_random_uuid()::text,'amount',10));
 perform public.erp_action(jsonb_build_object('action','customer_payment','request_id',gen_random_uuid(),'sale_id',legacy->>'id','amount',10));
 if not exists(select 1 from public.sales where id=(legacy->>'id')::uuid and is_opening_balance and payment_status='paid') then raise exception 'Settled legacy receipt lost its classification'; end if;
 if (select coalesce(sum(debit-credit),0) from public.erp_journal_lines)<>0 then raise exception 'Ledger unbalanced'; end if;
end $$;
reset role;
rollback;
