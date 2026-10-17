-- Run once in Supabase dashboard → SQL Editor.
-- Creates a public "images" bucket (anyone can view) limited to 5 MB images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Dev-only: lets anyone upload. Once you add Supabase Auth, replace "anon, authenticated"
-- with "authenticated" so only logged-in users can upload.
create policy "Anyone can upload images"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'images');

-- Deleting requires the caller to be able to select the row too
create policy "Anyone can read image rows"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'images');

create policy "Anyone can delete images (dev only)"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'images');
