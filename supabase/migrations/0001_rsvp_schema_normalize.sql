begin;

alter table if exists public."RSVP"
  add column if not exists attending boolean,
  add column if not exists email text;

update public."RSVP"
set attending = case
  when lower(coalesce("Yes/No", '')) in ('yes','y','true','1') then true
  when lower(coalesce("Yes/No", '')) in ('no','n','false','0') then false
  else null
end
where attending is null;

create index if not exists rsvp_created_at_idx on public."RSVP"(created_at desc);
create index if not exists rsvp_attending_idx on public."RSVP"(attending);
create index if not exists rsvp_email_idx on public."RSVP"(email);

alter table public."RSVP" enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'RSVP'
      and policyname = 'public_rsvp_insert'
  ) then
    create policy "public_rsvp_insert"
      on public."RSVP"
      for insert
      to public
      with check (
        char_length(coalesce("Name", '')) > 0
        and attending is not null
      );
  end if;
end$$;

commit;
