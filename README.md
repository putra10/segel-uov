# Segel

Tanda tangan dokumen dengan skema UOV (Unbalanced Oil and Vinegar), langsung di browser.
Proyek Pemodelan Matematika, Kelompok 3B, Departemen Matematika FMIPA UI, 2026.

Ubah satu huruf di dokumen yang sudah disegel, dan verifikasinya gagal.

## Halaman

| Halaman | Isi |
|---|---|
| `index.html` | Beranda, dengan cap titik yang ditandatangani UOV secara langsung |
| `tandatangani.html` | Taruh dokumen, tulis nama, segel. PDF dan DOCX mendapat tanda tangan di dalam berkasnya; berkas lain mendapat file `.segel` |
| `verifikasi.html` | Taruh dokumen yang diterima. PDF dan DOCX bertanda tangan cukup berkas itu saja |
| `cara-kerja.html` | Skema yang sama dengan parameter kecil di F7, supaya setiap angka bisa diikuti |

## Parameter

GF(16), n = 160 variabel, v = 96 vinegar, m = 64 persamaan (set tingkat 1 dari spesifikasi UOV untuk NIST).
Kunci publik 412.160 byte, tanda tangan 96 byte. Target hash memakai SHA-256 dengan salt 16 byte.

## Menjalankan

```
python serve.py
```

Lalu buka http://localhost:5317. Server ini mematikan cache supaya perubahan langsung terlihat.
Situsnya statis, jadi bisa juga di-deploy apa adanya ke Vercel atau GitHub Pages.

## Uji

```
node test-segel.mjs   # UOV tingkat 1: sign, verify, berkas diubah, kunci lain, format bukti, token QR
node test-toy.mjs     # UOV mainan di F7: 300 pasangan kunci
```

## Struktur

- `js/uov.mjs` mesin UOV atas GF(16)
- `js/protocol.mjs` manifest, bukti `.segel`, token QR, pemeriksaan
- `js/docx.mjs`, `js/pdf.mjs` tanda tangan yang disisipkan ke dalam DOCX dan PDF
- `js/uov-toy.mjs` versi mainan untuk halaman Cara kerja
- `js/titik.mjs` cap titik di kanvas, ukuran tiap titik mengikuti satu elemen σ
- `css/segel.css` seluruh gaya

## Batasan

Prototipe riset. Implementasinya belum diaudit dan formatnya tidak sama dengan pustaka standar seperti liboqs,
jadi jangan dipakai untuk dokumen resmi. Matematika hanya membuktikan pemegang kunci privat yang menandatangani;
milik siapa kunci itu tetap perlu dicocokkan lewat sidik jarinya.
