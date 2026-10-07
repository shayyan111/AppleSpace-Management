-- Access tests temporarily change the existing test subject within a rollback.
begin;
select set_config('request.jwt.claim.sub','2ae01632-c454-4da4-a10d-aaab05b5c484',true);
update public.user_profiles set role='salesperson' where id='2ae01632-c454-4da4-a10d-aaab05b5c484';
set local role authenticated;
do $$ declare d jsonb; begin
 d:=public.erp_read();
 if d ? 'costs' or d ? 'accounts' or d ? 'purchases' then raise exception 'Salesperson received private financial data'; end if;
 if exists(select 1 from jsonb_array_elements(d->'inventory') x where x ? 'purchase_price') then raise exception 'Cost leak'; end if;
 begin perform public.erp_action(jsonb_build_object('action','expense','request_id',gen_random_uuid(),'description','Forbidden','amount',1));raise exception 'Forbidden expense allowed'; exception when others then if sqlerrm='Forbidden expense allowed' then raise; end if; end;
 begin perform public.erp_get_backup();raise exception 'Forbidden backup allowed'; exception when others then if sqlerrm='Forbidden backup allowed' then raise; end if; end;
 if exists(select 1 from public.sale_item_costs) then raise exception 'Cost table exposed'; end if;
 if exists(select 1 from public.erp_journal_lines) then raise exception 'Journal table exposed'; end if;
 if has_table_privilege('authenticated','public.sales','INSERT') then raise exception 'Direct sale writes permitted'; end if;
end $$;
reset role;
update public.user_profiles set role='manager' where id='2ae01632-c454-4da4-a10d-aaab05b5c484';
set local role authenticated;
do $$ declare d jsonb; begin
 d:=public.erp_read();if d ? 'costs' or d ? 'accounts' then raise exception 'Manager financial report leak'; end if;
end $$;
reset role;
update public.user_profiles set is_active=false where id='2ae01632-c454-4da4-a10d-aaab05b5c484';
set local role authenticated;
do $$ begin
 begin perform public.erp_read();raise exception 'Inactive user allowed'; exception when others then if sqlerrm='Inactive user allowed' then raise; end if; end;
end $$;
rollback;
