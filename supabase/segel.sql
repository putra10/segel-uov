-- Arsip Segel di proyek Supabase yang sudah ada.
-- Jalankan sekali di SQL Editor. Semua nama berawalan segel_ / bucket "segel",
-- jadi tabel dan aturan akses lain di proyek ini tidak tersentuh.
--
-- Isi arsip:
--   segel_arsip      satu baris per dokumen yang disegel: manifest, σ, dan sidik jari kunci.
--                    Dokumennya sendiri tidak disimpan; manifest memuat SHA-256-nya.
--   bucket "segel"   kunci/<sidik jari>.bin  kunci publik UOV (412.160 byte), satu per kunci
--
-- Akses dari situs (peran anon):
--   - tidak bisa membaca, mengubah, atau menghapus tabel secara langsung;
--   - menyimpan lewat segel_simpan(), membaca satu entri lewat segel_ambil(id);
--   - mengunggah ke bucket segel hanya di folder kunci/, tanpa bisa menimpa,
--     menghapus, atau menampilkan daftar isi bucket.

create table if not exists public.segel_arsip (
  id         text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),   -- 128 bit acak, dibuat situs
  manifest   jsonb not null,
  signature  text  not null check (length(signature) between 100 and 200),
  key_fp     text  not null check (key_fp ~ '^[a-f0-9]{64}$'),
  dok_path   text  check (dok_path is null or dok_path = 'dok/' || id),
  created_at timestamptz not null default now()
);

alter table public.segel_arsip enable row level security;
-- Tanpa policy: anon dan authenticated tidak bisa SELECT/INSERT/UPDATE/DELETE langsung.
revoke all on public.segel_arsip from anon, authenticated;

create or replace function public.segel_simpan(p_id text, p_manifest jsonb, p_signature text, p_dok boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_manifest->>'key' is null or p_manifest->>'key' !~ '^[a-f0-9]{64}$' then
    raise exception 'manifest tidak valid';
  end if;
  insert into segel_arsip (id, manifest, signature, key_fp, dok_path)
  values (p_id, p_manifest, p_signature, p_manifest->>'key', case when p_dok then 'dok/' || p_id end);
end $$;

create or replace function public.segel_ambil(p_id text)
returns table (manifest jsonb, signature text, key_fp text, dok_path text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select manifest, signature, key_fp, dok_path, created_at from segel_arsip where id = p_id
$$;

revoke all on function public.segel_simpan(text, jsonb, text, boolean) from public;
revoke all on function public.segel_ambil(text) from public;
grant execute on function public.segel_simpan(text, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.segel_ambil(text) to anon, authenticated;

-- Bucket publik: kunci publik bisa diunduh lewat URL kalau sidik jarinya diketahui,
-- tetapi tanpa policy SELECT isinya tidak bisa didaftar. Batas 1 MB cukup untuk kunci 412 KB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('segel', 'segel', true, 1048576, array['application/octet-stream'])
on conflict (id) do update set file_size_limit = 1048576;

drop policy if exists segel_unggah on storage.objects;
create policy segel_unggah on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'segel' and (storage.foldername(name))[1] = 'kunci');
-- Tidak ada policy UPDATE/DELETE/SELECT untuk bucket ini: unggahan tidak bisa ditimpa atau dihapus dari situs.
