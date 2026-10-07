-- Keep document product details stable and use the saved accessory supplier.
alter table public.purchases add column item_details jsonb;
alter table public.purchases add constraint purchases_item_details_check check(item_details is null or jsonb_typeof(item_details)='array');
update public.purchases p set item_details=(select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('model',i.model,'storage',i.storage,'pta_status',i.pta_status,'imei_1',i.imei_1,'imei_2',i.imei_2,'serial_number',i.serial_number,'battery_health',i.battery_health,'color',nullif(trim(i.color),''),'condition_grade',nullif(trim(i.condition_grade),''),'warranty_notes',nullif(trim(i.warranty_notes),''),'purchase_price',i.purchase_price))) from public.inventory_items i where i.purchase_id=p.id)
where exists(select 1 from public.inventory_items i where i.purchase_id=p.id);
-- Earlier accessory batches cannot be reconstructed from today's stock quantity.
-- Their slips retain purchase totals; all new accessory batches get exact snapshots.
update public.sale_items s set phone_details=s.phone_details||jsonb_strip_nulls(jsonb_build_object('color',nullif(trim(i.color),''),'condition_grade',nullif(trim(i.condition_grade),''),'warranty_notes',nullif(trim(i.warranty_notes),'')))
from public.inventory_items i where i.id=s.inventory_item_id and s.phone_details is not null;

do $patch$
declare definition text; old_branch text:=' elsif a=''accessory_restock'' then
 v:=(p->>''accessory_id'')::uuid; qty:=(p->>''quantity'')::integer; paid:=(p->>''paid'')::numeric;
 select * into stock from public.accessories where id=v for update;
 if not found then raise exception ''Accessory not found''; end if;
 price:=stock.purchase_price; if qty is null or qty<=0 or price is null or price<0 then raise exception ''Valid quantity and saved unit cost required''; end if;
 total:=price*qty; if paid<0 or paid>total or paid<>round(paid,2) then raise exception ''Invalid purchase payment''; end if;
 sid:=nullif(p->>''supplier_id'','''')::uuid;
 if sid is null then if nullif(trim(p->>''supplier_name''),'''') is null then raise exception ''Accessory supplier required''; end if; insert into public.sellers(full_name,seller_kind) values(trim(p->>''supplier_name''),''accessory_supplier'') returning id into sid;
 elsif not exists(select 1 from public.sellers where id=sid and seller_kind=''accessory_supplier'') then raise exception ''Choose an accessory supplier''; end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,total,p->>''notes'',auth.uid()) returning id into iid;
 update public.accessories set purchase_price=round(((quantity*purchase_price)+(qty*price))/(quantity+qty),2),quantity=quantity+qty,supplier_id=sid,purchase_id=iid,sale_price=coalesce(nullif(p->>''sale_price'','''')::numeric,sale_price),updated_at=now() where id=v;
 if total>0 then perform private.erp_post(''purchase'',iid,''Accessory restock'',jsonb_build_array(jsonb_build_object(''account'',''1200'',''debit'',total),jsonb_build_object(''account'',''2000'',''credit'',total))); end if;
 if paid>0 then insert into public.supplier_payments(purchase_id,amount,method,created_by) values(iid,paid,method,auth.uid()) returning id into sid; perform private.erp_post(''supplier_payment'',sid,''Accessory restock payment'',jsonb_build_array(jsonb_build_object(''account'',''2000'',''debit'',paid),jsonb_build_object(''account'',acc,''credit'',paid))); end if;
'; new_branch text:=' elsif a=''accessory_restock'' then
 v:=(p->>''accessory_id'')::uuid; qty:=(p->>''quantity'')::integer; paid:=(p->>''paid'')::numeric;
 select * into stock from public.accessories where id=v for update;
 if not found then raise exception ''Accessory not found''; end if;
 price:=stock.purchase_price; if qty is null or qty<=0 or price is null or price<0 then raise exception ''Valid quantity and saved unit cost required''; end if;
 total:=price*qty; if paid<0 or paid>total or paid<>round(paid,2) then raise exception ''Invalid purchase payment''; end if;
 sid:=coalesce(stock.supplier_id,(select seller_id from public.purchases where id=stock.purchase_id));
 if sid is null or not exists(select 1 from public.sellers where id=sid and seller_kind=''accessory_supplier'') then raise exception ''Existing accessory supplier is missing''; end if;
 insert into public.purchases(seller_id,total_amount,notes,created_by) values(sid,total,p->>''notes'',auth.uid()) returning id into iid;
 update public.accessories set purchase_price=round(((quantity*purchase_price)+(qty*price))/(quantity+qty),2),quantity=quantity+qty,supplier_id=sid,purchase_id=iid,sale_price=coalesce(nullif(p->>''sale_price'','''')::numeric,sale_price),updated_at=now() where id=v;
 if total>0 then perform private.erp_post(''purchase'',iid,''Accessory restock'',jsonb_build_array(jsonb_build_object(''account'',''1200'',''debit'',total),jsonb_build_object(''account'',''2000'',''credit'',total))); end if;
 if paid>0 then insert into public.supplier_payments(purchase_id,amount,method,created_by) values(iid,paid,method,auth.uid()) returning id into sid; perform private.erp_post(''supplier_payment'',sid,''Accessory restock payment'',jsonb_build_array(jsonb_build_object(''account'',''2000'',''debit'',paid),jsonb_build_object(''account'',acc,''credit'',paid))); end if;
';
begin
 definition:=pg_get_functiondef('private.erp_action(jsonb)'::regprocedure);
 if strpos(definition,old_branch)=0 or strpos(definition,'jsonb_strip_nulls(jsonb_build_object(''model'',item.model,''storage'',item.storage,''pta_status'',item.pta_status,''imei_1'',item.imei_1,''imei_2'',item.imei_2,''serial_number'',item.serial_number,''battery_health'',item.battery_health))')=0 or strpos(definition,' result:=jsonb_build_object(''id'',v,''inventory_id'',iid);')=0 then raise exception 'Unexpected ERP action version'; end if;
 definition:=replace(definition,old_branch,new_branch);
 definition:=replace(definition,'jsonb_strip_nulls(jsonb_build_object(''model'',item.model,''storage'',item.storage,''pta_status'',item.pta_status,''imei_1'',item.imei_1,''imei_2'',item.imei_2,''serial_number'',item.serial_number,''battery_health'',item.battery_health))','jsonb_strip_nulls(jsonb_build_object(''model'',item.model,''storage'',item.storage,''pta_status'',item.pta_status,''imei_1'',item.imei_1,''imei_2'',item.imei_2,''serial_number'',item.serial_number,''battery_health'',item.battery_health,''color'',nullif(trim(item.color),''''),''condition_grade'',nullif(trim(item.condition_grade),''''),''warranty_notes'',nullif(trim(item.warranty_notes),'''')))');
 definition:=replace(definition,' result:=jsonb_build_object(''id'',v,''inventory_id'',iid);',' if a=''purchase'' then
 update public.purchases set item_details=(select jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(''model'',i.model,''storage'',i.storage,''pta_status'',i.pta_status,''imei_1'',i.imei_1,''imei_2'',i.imei_2,''serial_number'',i.serial_number,''battery_health'',i.battery_health,''color'',nullif(trim(i.color),''''),''condition_grade'',nullif(trim(i.condition_grade),''''),''warranty_notes'',nullif(trim(i.warranty_notes),''''),''purchase_price'',i.purchase_price))) from public.inventory_items i where i.id=iid) where id=v;
 elsif a=''accessory_purchase'' then
 update public.purchases set item_details=(select jsonb_build_array(jsonb_build_object(''name'',s.name,''category'',s.category,''sku'',s.sku,''quantity'',qty,''purchase_price'',price)) from public.accessories s where s.id=iid) where id=v;
 elsif a=''accessory_restock'' then
 update public.purchases set item_details=jsonb_build_array(jsonb_build_object(''name'',stock.name,''category'',stock.category,''sku'',stock.sku,''quantity'',qty,''purchase_price'',stock.purchase_price)) where id=iid;
 end if;
 result:=jsonb_build_object(''id'',v,''inventory_id'',iid);');
 execute definition;
end $patch$;
notify pgrst,'reload schema';
