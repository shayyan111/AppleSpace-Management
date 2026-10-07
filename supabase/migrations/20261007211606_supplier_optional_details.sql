-- Requires the V5 workflow upgrade. Patch only seller-details validation so later
-- ERP action branches, transaction locking, idempotency and privileges are retained.
do $migration$
declare
 definition text:=pg_get_functiondef('private.erp_action(jsonb)'::regprocedure);
 old_fragment text:=$old$ seller_cnic:=coalesce(nullif(p->>'cnic',''),seller.cnic);
 seller_mobile:=coalesce(nullif(p->>'mobile',''),seller.mobile);
 seller_photo:=coalesce(nullif(p->>'photo_url',''),seller.photo_url);
 if coalesce(seller_cnic,'') !~ '^[0-9]{13}$' then raise exception 'Seller CNIC must contain 13 digits'; end if;
 if coalesce(seller_mobile,'') !~ '^[0-9]{11}$' then raise exception 'Seller mobile must contain 11 digits'; end if;
 if coalesce(p->>'seller_kind','supplier')='walk_in' and nullif(seller_photo,'') is null then raise exception 'Walk-in seller photo required'; end if;$old$;
 new_fragment text:=$new$ seller_cnic:=coalesce(nullif(trim(p->>'cnic'),''),nullif(trim(seller.cnic),''));
 seller_mobile:=coalesce(nullif(trim(p->>'mobile'),''),nullif(trim(seller.mobile),''));
 seller_photo:=coalesce(nullif(p->>'photo_url',''),nullif(seller.photo_url,''));
 if nullif(trim(coalesce(nullif(p->>'supplier_name',''),seller.full_name)),'') is null then raise exception 'Seller name required'; end if;
 -- Walk-in identity details stay required; registered suppliers may provide a name only.
 if (coalesce(p->>'seller_kind','supplier')='walk_in' or seller_cnic is not null)
 and coalesce(seller_cnic,'') !~ '^[0-9]{13}$' then raise exception 'Seller CNIC must contain 13 digits'; end if;
 if (coalesce(p->>'seller_kind','supplier')='walk_in' or seller_mobile is not null)
 and coalesce(seller_mobile,'') !~ '^[0-9]{11}$' then raise exception 'Seller mobile must contain 11 digits'; end if;
 if coalesce(p->>'seller_kind','supplier')='walk_in' and nullif(seller_photo,'') is null then raise exception 'Walk-in seller photo required'; end if;$new$;
begin
 if strpos(definition,new_fragment)>0 then return; end if;
 if strpos(definition,old_fragment)=0 then raise exception 'Unexpected ERP action version: review supplier validation before applying'; end if;
 execute replace(definition,old_fragment,new_fragment);
end $migration$;
notify pgrst,'reload schema';
