-- Optional ledger descriptions, conditional expense descriptions, named billing,
-- stored-cost accessory restocking and required purchase payments.
alter table public.erp_ledger_entries drop constraint erp_ledger_entries_description_check;
alter table public.erp_ledger_entries alter column description set default '';
alter table public.erp_ledger_entries add constraint erp_ledger_entries_description_check check(length(description)<=1000);

alter table public.sale_items add column phone_details jsonb;
alter table public.sale_items add constraint sale_items_phone_details_check check(phone_details is null or jsonb_typeof(phone_details)='object');
update public.sale_items si set phone_details=jsonb_strip_nulls(jsonb_build_object('model',i.model,'storage',i.storage,'pta_status',i.pta_status,'imei_1',i.imei_1,'imei_2',i.imei_2,'serial_number',i.serial_number,'battery_health',i.battery_health))
from public.inventory_items i where si.inventory_item_id=i.id and si.phone_details is null;

create function pg_temp.erp_replace(definition text,old_value text,new_value text) returns text
language plpgsql set search_path='' as $$
begin
 if strpos(definition,old_value)=0 then raise exception 'Unexpected ERP function version for patch'; end if;
 return replace(definition,old_value,new_value);
end $$;

do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('private.erp_ledger_action(jsonb)'::regprocedure);
 definition:=pg_temp.erp_replace(definition,
  '  if nullif(trim(p->>''description''),'''') is null then raise exception ''Description required''; end if;',
  '  if coalesce(length(p->>''description''),0)>1000 then raise exception ''Description is too long''; end if;');
 definition:=pg_temp.erp_replace(definition,'category,trim(p->>''description''),','category,coalesce(trim(p->>''description''),''''),');
 definition:=pg_temp.erp_replace(definition,'v,trim(p->>''description''),case',
  'v,coalesce(nullif(trim(p->>''description''),''''),kind||'': ''||trim(p->>''full_name'')),case');
 execute definition;

 definition:=pg_get_functiondef('private.erp_action(jsonb)'::regprocedure);
 definition:=pg_temp.erp_replace(definition,' method:=coalesce(p->>''method'',''cash'')::public.payment_method;',$paid$
 if a in ('purchase','accessory_purchase','accessory_restock') and nullif(trim(p->>'paid'),'') is null then raise exception 'Paid now required; enter 0 for an unpaid purchase'; end if;
 method:=coalesce(p->>'method','cash')::public.payment_method;$paid$);
 -- Text billing name is recorded separately from the authenticated actor. Legacy
 -- active staff selections still work while older frontend sessions are open.
 definition:=pg_temp.erp_replace(definition,' elsif a=''sale'' then',$bill$ elsif a='sale' then
 if p ? 'billed_by_name' then
  if nullif(trim(p->>'billed_by_name'),'') is null or length(trim(p->>'billed_by_name'))>120 then raise exception 'Enter the name of the person who made the bill (up to 120 characters)'; end if;
  p:=p||jsonb_build_object('billed_by',auth.uid());
 end if;$bill$);
 definition:=pg_temp.erp_replace(definition,
  '(select u.full_name from public.user_profiles u where u.id=(p->>''billed_by'')::uuid),coalesce(p->>''sale_kind'',''customer''))',
  'coalesce(nullif(trim(p->>''billed_by_name''),''''),(select u.full_name from public.user_profiles u where u.id=(p->>''billed_by'')::uuid)),coalesce(p->>''sale_kind'',''customer''))');
 definition:=pg_temp.erp_replace(definition,
  'insert into public.sale_items(sale_id,inventory_item_id,item_name,unit_price,discount,final_price) values(v,item.id,item.model,price,discount,price-discount)',
  'insert into public.sale_items(sale_id,inventory_item_id,item_name,unit_price,discount,final_price,phone_details) values(v,item.id,item.model,price,discount,price-discount,jsonb_strip_nulls(jsonb_build_object(''model'',item.model,''storage'',item.storage,''pta_status'',item.pta_status,''imei_1'',item.imei_1,''imei_2'',item.imei_2,''serial_number'',item.serial_number,''battery_health'',item.battery_health)))');

 definition:=pg_temp.erp_replace(definition,
  'v:=(p->>''accessory_id'')::uuid; qty:=(p->>''quantity'')::integer; price:=(p->>''purchase_price'')::numeric; paid:=coalesce((p->>''paid'')::numeric,0);',
  'v:=(p->>''accessory_id'')::uuid; qty:=(p->>''quantity'')::integer; paid:=(p->>''paid'')::numeric;');
 definition:=pg_temp.erp_replace(definition,
  'if qty is null or qty<=0 or price is null or price<0 or price<>round(price,2) then raise exception ''Valid quantity and unit cost required''; end if;',
  'price:=stock.purchase_price; if qty is null or qty<=0 or price is null or price<0 then raise exception ''Valid quantity and saved unit cost required''; end if;');
 -- Description is optional except Other / Others categories, including phone expenses.
 definition:=pg_temp.erp_replace(definition,
  'if amt<=0 or nullif(trim(p->>''description''),'''') is null then raise exception ''Description and positive amount required''; end if;',
  $expense$if amt<=0 then raise exception 'Positive expense amount required'; end if;
 if coalesce(length(p->>'description'),0)>1000 then raise exception 'Description is too long'; end if;
 if lower(trim(coalesce(nullif(p->>'category',''),'Other'))) ~ '^others?($|[[:space:]])' and nullif(trim(p->>'description'),'') is null then raise exception 'Description required for Other expenses'; end if;$expense$);
 definition:=pg_temp.erp_replace(definition,
  'coalesce(nullif(p->>''category'',''''),''Other''),p->>''description'',amt',
  'coalesce(nullif(p->>''category'',''''),''Other''),coalesce(trim(p->>''description''),''''),amt');
 definition:=pg_temp.erp_replace(definition,
  'coalesce(nullif(p->>''category'',''''),''Phone expense''),p->>''description'',amt',
  'coalesce(nullif(p->>''category'',''''),''Phone expense''),coalesce(trim(p->>''description''),''''),amt');
 definition:=pg_temp.erp_replace(definition,
  'perform private.erp_post(''expense'',v,p->>''description'',',
  'perform private.erp_post(''expense'',v,coalesce(nullif(trim(p->>''description''),''''),nullif(p->>''category'',''''),''Other expense''),');
 execute definition;
end $patch$;
drop function pg_temp.erp_replace(text,text,text);
notify pgrst,'reload schema';
