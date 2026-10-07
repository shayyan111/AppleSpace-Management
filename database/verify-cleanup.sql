-- Run after the record_cleanup migration. Fixtures and deletions are ALL ROLLED BACK.
begin;
select set_config('request.jwt.claim.sub',(select id::text from public.user_profiles where role='owner' and is_active order by created_at limit 1),true);
do $$
<<verify_cleanup>>
declare
 y integer:=extract(year from now() at time zone 'Asia/Karachi')::integer-1;
 start_date date:=make_date(y,5,1); end_date date:=make_date(y,5,31); stamp timestamptz;
 kind text; p jsonb; s jsonb; plan jsonb; result jsonb; replay jsonb; req uuid:=gen_random_uuid();
 owner_id uuid:=auth.uid(); purchase_id uuid; inventory_id uuid; sale_id uuid;
 snapshot_id uuid; eligible_sales uuid[]:=array[]::uuid[]; retained_sales uuid[]:=array[]::uuid[];
 active_id uuid; current_expense uuid; old_expense uuid; current_inventory uuid;
 balances jsonb; after_balances jsonb; ledger_count bigint; old_session uuid; open_session uuid; changed uuid; protected_purchases uuid[]:=array[]::uuid[]; protected_inventory uuid[]:=array[]::uuid[];
begin
 if owner_id is null then raise exception 'Verification needs an existing active owner'; end if;
 foreach kind in array array['first_day','last_day','unpaid','current_payment','outside_payment','current_sale','current_child','current_archive','active_stock','current_inventory','unpaid_purchase','current_supplier_payment'] loop
  stamp:=((case when kind='last_day' then end_date else start_date end)::timestamp + interval '12 hours') at time zone 'Asia/Karachi';
  p:=public.erp_action(jsonb_build_object('action','purchase','paid',0,'storage','128GB','pta_status','non_pta','request_id',gen_random_uuid(),'supplier_name','Cleanup verification','seller_kind','supplier','cnic',floor(1000000000000+random()*8000000000000)::bigint::text,'mobile','03000000000','model','Cleanup verification '||kind,'imei_1',floor(100000000000000+random()*800000000000000)::bigint::text,'purchase_price',100,'paid',case when kind='unpaid_purchase' then 50 else 100 end));
  purchase_id:=(p->>'id')::uuid;inventory_id:=(p->>'inventory_id')::uuid;
  if kind<>'active_stock' then
   s:=public.erp_action(jsonb_build_object('action','sale','request_id',gen_random_uuid(),'inventory_id',inventory_id,'price',200,'paid',case when kind='unpaid' then 50 else 200 end,'customer_name','Cleanup verification','customer_mobile','03000000001','billed_by',owner_id));
   sale_id:=(s->>'id')::uuid;
   update public.sales set sale_date=case when kind='current_sale' then now() else stamp end,created_at=stamp where id=sale_id;
   update public.payments set payment_date=case when kind='current_payment' then now() when kind='outside_payment' then stamp-interval '1 day' else stamp end,created_at=stamp where public.payments.sale_id=verify_cleanup.sale_id;
   update public.sale_items set created_at=case when kind='current_child' then now() else stamp end where public.sale_items.sale_id=verify_cleanup.sale_id;
   update public.sale_item_costs set created_at=stamp where sale_item_id in(select id from public.sale_items where public.sale_items.sale_id=verify_cleanup.sale_id);
   update public.sold_phones set sold_at=case when kind='current_archive' then now() else stamp end where original_inventory_id=inventory_id;
   if kind in ('first_day','last_day','current_inventory','unpaid_purchase','current_supplier_payment') then eligible_sales:=array_append(eligible_sales,sale_id);
   else retained_sales:=array_append(retained_sales,sale_id); end if;
  else active_id:=inventory_id; end if;
  update public.purchases set purchase_date=stamp,created_at=stamp where id=purchase_id;
  update public.supplier_payments set payment_date=case when kind='current_supplier_payment' then now() else stamp end where public.supplier_payments.purchase_id=verify_cleanup.purchase_id;
  update public.inventory_items set created_at=case when kind='current_inventory' then now() else stamp end,sold_at=case when kind='active_stock' then null else stamp end where id=inventory_id;
  update public.stock_movements set created_at=stamp where inventory_item_id=inventory_id;
  if kind='current_inventory' then current_inventory:=inventory_id; end if;
  if kind in ('unpaid_purchase','current_supplier_payment') then
   protected_purchases:=array_append(protected_purchases,purchase_id);protected_inventory:=array_append(protected_inventory,inventory_id);
  end if;
 end loop;
 insert into public.expenses(category,description,amount,expense_date,created_by) values('test','Cleanup old fixture',1,(end_date::timestamp+interval '23 hours 59 minutes') at time zone 'Asia/Karachi',owner_id) returning id into old_expense;
 insert into public.expenses(category,description,amount,expense_date,created_by) values('test','Cleanup protected fixture',1,now(),owner_id) returning id into current_expense;
 -- Avoid the unique currently open session index while exercising protection.
 select id into open_session from public.daily_sessions where closed_at is null limit 1;
 insert into public.daily_sessions(business_date,opening_cash,opened_at,closed_at,created_by) values(make_date(y,2,1),0,make_date(y,2,1)::timestamp at time zone 'Asia/Karachi',now(),owner_id) returning id into old_session;
 select coalesce(jsonb_object_agg(account_code,balance),'{}') into balances from (select account_code,sum(debit-credit) balance from public.erp_journal_lines group by account_code) b;
 select count(*) into ledger_count from public.erp_journals;
 plan:=public.erp_cleanup_preview(start_date,end_date);
 if (plan->'counts'->>'sales')::integer<3 then raise exception 'Eligible boundary invoices missing'; end if;
 if (plan->'protected'->>'sales')::integer<5 then raise exception 'Protected invoice count missing'; end if;
 -- A new candidate invalidates the old preview; no partial deletion/backup can occur.
 insert into public.expenses(category,description,amount,expense_date,created_by) values('test','Stale preview fixture',1,start_date::timestamp at time zone 'Asia/Karachi',owner_id) returning id into changed;
 begin
  perform public.erp_cleanup_delete(start_date,end_date,plan->>'token','DELETE '||start_date||' TO '||end_date,req);
  raise exception 'Stale preview accepted';
 exception when others then if sqlerrm<>'Records changed. Preview the date range again before deleting' then raise; end if; end;
 plan:=public.erp_cleanup_preview(start_date,end_date);
 begin
  perform public.erp_cleanup_delete(start_date,end_date,plan->>'token','DELETE',req);
  raise exception 'Confirmation bypass accepted';
 exception when others then if sqlerrm<>'Type the exact deletion confirmation' then raise; end if; end;
 execute 'set local role authenticated';
 result:=public.erp_cleanup_delete(start_date,end_date,plan->>'token','DELETE '||start_date||' TO '||end_date,req);
 replay:=public.erp_cleanup_delete(start_date,end_date,plan->>'token','DELETE '||start_date||' TO '||end_date,req);
 execute 'reset role';
 if replay<>result then raise exception 'Retry was not idempotent'; end if;
 if result->'counts'<>plan->'counts' then raise exception 'Deleted counts differ from preview'; end if;
 if exists(select 1 from public.sales where id=any(eligible_sales)) then raise exception 'Eligible invoice retained'; end if;
 if (select count(*) from public.sales where id=any(retained_sales))<>cardinality(retained_sales) then raise exception 'Protected invoice deleted'; end if;
 if (select count(*) from public.purchases where id=any(protected_purchases))<>2 or (select count(*) from public.inventory_items where id=any(protected_inventory))<>2 then raise exception 'Unpaid or newer-linked purchase/stock deleted'; end if;
 if not exists(select 1 from public.inventory_items where id=active_id and status='in_stock') then raise exception 'Active stock deleted'; end if;
 if not exists(select 1 from public.inventory_items where id=current_inventory) then raise exception 'Current year inventory deleted'; end if;
 if not exists(select 1 from public.expenses where id=current_expense) or exists(select 1 from public.expenses where id=old_expense) then raise exception 'Expense date boundaries incorrect'; end if;
 if not exists(select 1 from public.daily_sessions where id=old_session) then raise exception 'Session closed this year deleted'; end if;
 snapshot_id:=(result->>'backup_id')::uuid;
 if not exists(select 1 from public.erp_backups b cross join lateral jsonb_array_elements(b.data->'sales') saved_sale where b.id=snapshot_id and saved_sale->>'id'=eligible_sales[1]::text) then raise exception 'Pre-deletion snapshot missing removed invoice'; end if;
 select coalesce(jsonb_object_agg(account_code,balance),'{}') into after_balances from (select account_code,sum(debit-credit) balance from public.erp_journal_lines group by account_code) b;
 if balances<>after_balances or (select count(*) from public.erp_journals)<>ledger_count then raise exception 'Accounting changed'; end if;
 if (select coalesce(sum(debit-credit),0) from public.erp_journal_lines)<>0 then raise exception 'Ledger unbalanced'; end if;
 if not exists(select 1 from public.erp_audit where record_id=req and action='record_cleanup') then raise exception 'Cleanup audit missing'; end if;
end $$;
set local role authenticated;
do $$
declare cutoff date:=date_trunc('year',now() at time zone 'Asia/Karachi')::date;
begin
 begin
  perform public.erp_cleanup_preview(cutoff-1,cutoff);
  raise exception 'Current-year preview accepted';
 exception when others then if sqlerrm<>'Records from the current year or future years cannot be deleted' then raise; end if; end;
 begin
  perform public.erp_cleanup_delete(cutoff,cutoff,'forged','DELETE '||cutoff||' TO '||cutoff,gen_random_uuid());
  raise exception 'Current-year direct delete accepted';
 exception when others then if sqlerrm<>'Records from the current year or future years cannot be deleted' then raise; end if; end;
 begin
  perform public.erp_cleanup_preview(cutoff-1,cutoff-2);
  raise exception 'Reversed range accepted';
 exception when others then if sqlerrm<>'Choose a valid start date on or before the end date' then raise; end if; end;
 perform public.erp_cleanup_preview(cutoff-2,cutoff-1);
end $$;
reset role;
update public.user_profiles set role='manager' where id=auth.uid();
set local role authenticated;
do $$
begin
 begin
  perform public.erp_cleanup_preview('2020-01-01','2020-01-02');raise exception 'Manager allowed preview';
 exception when others then if sqlerrm<>'Owner access required' then raise; end if; end;
 begin
  perform public.erp_cleanup_delete('2020-01-01','2020-01-02','forged','DELETE 2020-01-01 TO 2020-01-02',gen_random_uuid());raise exception 'Manager allowed delete';
 exception when others then if sqlerrm<>'Owner access required' then raise; end if; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.erp_cleanup_delete(date,date,text,text,uuid)','EXECUTE') or has_function_privilege('anon','public.erp_cleanup_preview(date,date)','EXECUTE') then raise exception 'Anonymous cleanup access'; end if;
 if has_function_privilege('authenticated','private.erp_cleanup_plan(date,date)','EXECUTE') then raise exception 'Internal plan exposed'; end if;
end $$;
rollback;
