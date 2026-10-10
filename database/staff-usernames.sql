-- Staff usernames
alter table public.user_profiles add column if not exists username text;
alter table public.user_profiles drop constraint if exists user_profiles_username_format;
alter table public.user_profiles add constraint user_profiles_username_format
check (username is null or (char_length(username) between 3 and 32 and username ~ '^[A-Za-z0-9._-]+$'));
create unique index if not exists user_profiles_username_lower_key
on public.user_profiles (lower(username)) where username is not null;
