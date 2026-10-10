-- Staff website portal access
-- Applied to Supabase production as migration: staff_website_portal_access

create or replace function public.erp_set_website_manager(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
 if current_user not in ('service_role','postgres','supabase_admin') then
   raise exception 'Service role required';
 end if;
 if p_active then
   insert into private.website_managers(user_id,active)
   values(p_user_id,true)
   on conflict(user_id) do update set active=true;
 else
   delete from private.website_managers where user_id=p_user_id;
 end if;
end $$;

revoke all on function public.erp_set_website_manager(uuid,boolean) from public, anon, authenticated;
grant execute on function public.erp_set_website_manager(uuid,boolean) to service_role;
