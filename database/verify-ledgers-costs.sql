-- All new ledger fixtures, invoices, backups and role changes are rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
set local role authenticated;
do $$
<<ledger_test>>
declare today date:=(now() at time zone 'Asia/Karachi')::date; r jsonb; receipt jsonb; pay jsonb; invoice jsonb; phone jsonb; accessory jsonb;
 first_entry uuid; req uuid:=gen_random_uuid(); payment_req uuid:=gen_random_uuid(); entry_id uuid; accessory_id uuid;
 mode text; before_cash numeric; after_cash numeric; income_before numeric; expense_before numeric; store jsonb; snapshot jsonb;
 owner_id uuid:=auth.uid(); field_name text; purchase_payload jsonb;
begin
 purchase_payload:=jsonb_build_object('action','purchase','paid',0,'request_id',gen_random_uuid(),'supplier_name','Required fields test','seller_kind','supplier','model','Required phone','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'storage','128GB','pta_status','non_pta','purchase_price',100);
 foreach field_name in array array['storage','pta_status','purchase_price'] loop
  begin
   perform public.erp_action(purchase_payload-field_name);raise exception 'Missing required purchase field accepted';
  exception when others then
   if sqlerrm<>(case field_name when 'storage' then 'Storage required' when 'pta_status' then 'PTA status required' else 'Purchase cost required' end) then raise; end if;
  end;
  begin
   perform public.erp_action(purchase_payload||jsonb_build_object(field_name,' '));raise exception 'Blank required purchase field accepted';
  exception when others then
   if sqlerrm<>(case field_name when 'storage' then 'Storage required' when 'pta_status' then 'PTA status required' else 'Purchase cost required' end) then raise; end if;
  end;
 end loop;
 select coalesce(sum(l.debit-l.credit),0) into before_cash from public.erp_journal_lines l where l.account_code='1000';
 select coalesce(sum(l.credit-l.debit),0) into income_before from public.erp_journal_lines l where l.account_code='4000';
 select coalesce(sum(l.debit-l.credit),0) into expense_before from public.erp_journal_lines l where l.account_code='5100';
 r:=public.erp_action(jsonb_build_object('action','ledger_entry','request_id',req,'kind','receivable','full_name','Other receivable test','category','existing_balance','description','Old amount owed','record_date',today,'amount',100));first_entry:=(r->>'id')::uuid;
 if public.erp_action(jsonb_build_object('action','ledger_entry','request_id',req))<>r then raise exception 'Ledger entry retry was not idempotent'; end if;
 receipt:=public.erp_action(jsonb_build_object('action','ledger_payment','request_id',payment_req,'entry_id',first_entry,'amount',40,'method','cash'));
 if public.erp_action(jsonb_build_object('action','ledger_payment','request_id',payment_req))<>receipt then raise exception 'Ledger receipt retry was not idempotent'; end if;
 if (select amount from public.erp_ledger_entries where id=first_entry)-(select sum(amount) from public.erp_ledger_payments where public.erp_ledger_payments.entry_id=first_entry)<>60 then raise exception 'Partial receivable wrong'; end if;
 begin
  perform public.erp_action(jsonb_build_object('action','ledger_payment','request_id',gen_random_uuid(),'entry_id',first_entry,'amount',61));raise exception 'Overpayment accepted';
 exception when others then if sqlerrm<>'Payment exceeds outstanding balance' then raise; end if; end;
 perform public.erp_action(jsonb_build_object('action','ledger_payment','request_id',gen_random_uuid(),'entry_id',first_entry,'amount',60,'method','bank_transfer'));
 if (select sum(amount) from public.erp_ledger_payments where public.erp_ledger_payments.entry_id=first_entry)<>100 then raise exception 'Full settlement wrong'; end if;
 r:=public.erp_action(jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'kind','payable','full_name','Other payable test','category','existing_balance','description','Old creditor balance','record_date',today,'amount',90));entry_id:=(r->>'id')::uuid;
 perform public.erp_action(jsonb_build_object('action','ledger_payment','request_id',gen_random_uuid(),'entry_id',entry_id,'amount',30,'method','cash'));
 if (select amount from public.erp_ledger_entries where id=entry_id)-(select sum(amount) from public.erp_ledger_payments where public.erp_ledger_payments.entry_id=ledger_test.entry_id)<>60 then raise exception 'Partial payable wrong'; end if;
 perform public.erp_action(jsonb_build_object('action','ledger_payment','request_id',gen_random_uuid(),'entry_id',entry_id,'amount',60,'method','bank_transfer'));
 -- Money advanced/borrowed uses cash; services/unpaid expenses affect profit but not cash until settled.
 foreach mode in array array['money_advance','money_borrowed','service_income','expense_owed'] loop
  perform public.erp_action(jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'kind',case when mode in ('money_advance','service_income') then 'receivable' else 'payable' end,'full_name','Ledger category test','category',mode,'description','Ledger category test','record_date',today,'amount',case when mode='service_income' then 70 when mode='expense_owed' then 20 else 10 end));
 end loop;
 select coalesce(sum(l.debit-l.credit),0) into after_cash from public.erp_journal_lines l where l.account_code='1000';
 if after_cash-before_cash<>10 then raise exception 'Cash effect of ledger receipts/payments incorrect'; end if;
 if (select coalesce(sum(l.credit-l.debit),0) from public.erp_journal_lines l where l.account_code='4000')-income_before<>70 then raise exception 'Opening balances or loans changed income'; end if;
 if (select coalesce(sum(l.debit-l.credit),0) from public.erp_journal_lines l where l.account_code='5100')-expense_before<>20 then raise exception 'Unpaid expense posting wrong'; end if;
 begin
  perform public.erp_action(jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'kind','receivable','full_name','Bad type','category','expense_owed','description','Invalid','record_date',today,'amount',10));raise exception 'Invalid category accepted';
 exception when others then if sqlerrm<>'Choose a valid ledger and balance type' then raise; end if; end;
 begin
  perform public.erp_action(jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'kind','receivable','full_name','Future entry','category','existing_balance','description','Invalid','record_date',today+1,'amount',10));raise exception 'Future record accepted';
 exception when others then if sqlerrm<>'Choose a valid record date and due date' then raise; end if; end;
 -- Full checkout with two complimentary cables: billed amount stays 120000, COGS is 100800.
 phone:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_name','Ledger phone supplier','seller_kind','supplier','model','Ledger cost test phone','imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'purchase_price',100000,'paid',0));
 accessory:=public.erp_action(jsonb_build_object('action','accessory_purchase','request_id',gen_random_uuid(),'supplier_name','Ledger cable supplier','name','Ledger test cable','quantity',4,'purchase_price',400,'sale_price',700,'paid',0));accessory_id:=(accessory->>'inventory_id')::uuid;
 invoice:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',phone->>'inventory_id','price',120000,'paid',120000,'customer_name','Complimentary cable test','customer_mobile','03000000005','billed_by',owner_id,'extras',jsonb_build_array(jsonb_build_object('accessory_id',accessory_id,'name','Ledger test cable','quantity',2,'price',''))));
 if not exists(select 1 from public.sales where id=(invoice->>'id')::uuid and final_total=120000) then raise exception 'Complimentary accessory changed bill'; end if;
 if (select sum(c.cost_price_snapshot) from public.sale_item_costs c join public.sale_items i on i.id=c.sale_item_id where i.sale_id=(invoice->>'id')::uuid)<>100800 then raise exception 'Complimentary accessory purchase cost missing'; end if;
 if (select quantity from public.accessories where id=accessory_id)<>2 then raise exception 'Free accessories did not reduce stock'; end if;
 if not exists(select 1 from public.erp_journals j join public.erp_journal_lines l on l.journal_id=j.id where j.source_id=(invoice->>'id')::uuid and j.source_type='sale' and l.account_code='5000' and l.debit=100800) then raise exception 'Backend COGS posting wrong'; end if;
 store:=public.erp_read();
 if not exists(select 1 from jsonb_array_elements(store->'invoiceProfits') p where p->>'sale_id'=invoice->>'id' and (p->>'gross_profit')::numeric=19200 and (p->>'purchase_cost')::numeric=100800) then raise exception 'Backend invoice profit wrong'; end if;
 -- Restocking reuses saved purchase cost and keeps historical cost snapshots fixed.
 perform public.erp_action(jsonb_build_object('action','accessory_restock','request_id',gen_random_uuid(),'accessory_id',accessory_id,'supplier_name','Ledger second cable supplier','quantity',2,'paid',0));
 store:=public.erp_read();
 if not exists(select 1 from jsonb_array_elements(store->'invoiceProfits') p where p->>'sale_id'=invoice->>'id' and (p->>'gross_profit')::numeric=19200) then raise exception 'Restock changed historical profit'; end if;
 if not (store ? 'ledgerEntries') or not (store ? 'sessions') then raise exception 'Owner read missing data'; end if;
 snapshot:=public.erp_get_backup();
 if not (snapshot ? 'erp_ledger_entries') or not (snapshot ? 'erp_ledger_payments') then raise exception 'Ledger backup tables missing'; end if;
 if (select coalesce(sum(debit-credit),0) from public.erp_journal_lines)<>0 then raise exception 'Unbalanced ledger'; end if;
end $$;
reset role;
update public.user_profiles set role='manager' where id=auth.uid();
set local role authenticated;
do $$ declare store jsonb:=public.erp_read(); a text; begin
 if store ? 'sessions' or store ? 'invoiceProfits' or store ? 'accounts' or store ? 'journals' then raise exception 'Owner-only data leaked to manager'; end if;
 if not (store ? 'ledgerEntries') then raise exception 'Manager ledger missing'; end if;
 if exists(select 1 from public.daily_sessions) then raise exception 'Manager direct session read permitted'; end if;
 foreach a in array array['open_day','close_day'] loop begin
  perform public.erp_action(jsonb_build_object('action',a,'request_id',gen_random_uuid(),'amount',0));raise exception 'Manager cash-day action permitted';
 exception when others then if sqlerrm<>'Owner access required' then raise; end if; end; end loop;
end $$;
reset role;
update public.user_profiles set role='salesperson' where id=auth.uid();
set local role authenticated;
do $$ declare store jsonb:=public.erp_read(); a text; begin
 if store ? 'sessions' or store ? 'invoiceProfits' or store ? 'ledgerEntries' or store ? 'ledgerPayments' then raise exception 'Private data leaked to salesperson'; end if;
 if exists(select 1 from public.erp_ledger_entries) or exists(select 1 from public.erp_ledger_payments) then raise exception 'Salesperson direct ledger read allowed'; end if;
 foreach a in array array['open_day','close_day'] loop begin
  perform public.erp_action(jsonb_build_object('action',a,'request_id',gen_random_uuid(),'amount',0));raise exception 'Salesperson cash-day action permitted';
 exception when others then if sqlerrm<>'Owner access required' then raise; end if; end; end loop;
 begin perform public.erp_action(jsonb_build_object('action','ledger_entry','request_id',gen_random_uuid(),'amount',10));raise exception 'Staff ledger write allowed';
 exception when others then if sqlerrm<>'Manager access required' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','private.erp_ledger_action(jsonb)','EXECUTE') or has_function_privilege('authenticated','private.erp_read_extra(jsonb)','EXECUTE') then raise exception 'Internal function exposed'; end if;
 if has_table_privilege('authenticated','public.erp_ledger_entries','INSERT') or has_table_privilege('authenticated','public.erp_ledger_payments','UPDATE') then raise exception 'Direct ledger mutation allowed'; end if;
end $$;
rollback;
