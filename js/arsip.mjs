// Arsip Segel di Supabase: menyimpan bukti (manifest + σ) dan kunci publik, supaya QR cukup
// memuat ID arsip. Dokumennya tidak disimpan: penerima selalu memakai salinan yang ia terima,
// dan manifest sudah memuat SHA-256 dokumen itu. Skema dan aturan akses ada di supabase/segel.sql.
// Kunci "publishable" memang untuk kode situs; hak aksesnya dibatasi oleh aturan di SQL itu.
import { sha256 } from './protocol.mjs';

const URL_SB = 'https://iibicnzwzatilnyuelom.supabase.co';
const KUNCI_SB = 'sb_publishable_iP25DETc8owxUj9VtLDKEA_NIZ9SdqT';
const BUCKET = 'segel';
const hdr = (lain = {}) => ({ apikey: KUNCI_SB, ...lain });

export const POLA_ID = /^[A-Za-z0-9_-]{22}$/;

// 128 bit acak, base64url tanpa padding: 22 karakter.
export function idBaru() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function rpc(nama, args) {
  const r = await fetch(`${URL_SB}/rest/v1/rpc/${nama}`, { method: 'POST', headers: hdr({ 'Content-Type': 'application/json' }), body: JSON.stringify(args) });
  if (!r.ok) throw Error(`Arsip tidak bisa dihubungi (${r.status}).`);
  return r.status === 204 ? null : r.json();
}

// Unggahan tidak menimpa. Kunci publik yang sama dipakai banyak dokumen, jadi "sudah ada" dianggap berhasil.
async function unggah(path, bytes) {
  const r = await fetch(`${URL_SB}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: hdr({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' }), body: bytes });
  if (r.ok) return;
  const t = await r.text();
  if (/already exists|Duplicate|409/i.test(t)) return;
  throw Error(`Gagal mengunggah ke arsip (${r.status}).`);
}

async function unduhBerkas(path) {
  const r = await fetch(`${URL_SB}/storage/v1/object/public/${BUCKET}/${path}`);
  if (!r.ok) throw Error(`Berkas arsip tidak ditemukan (${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
}

// bukti: { manifest, signature }, publicKey: Uint8Array.
export async function simpan(id, bukti, publicKey) {
  if (!POLA_ID.test(id)) throw Error('ID arsip tidak valid.');
  await unggah(`kunci/${bukti.manifest.key}.bin`, publicKey);
  await rpc('segel_simpan', { p_id: id, p_manifest: bukti.manifest, p_signature: bukti.signature, p_dok: false });
  return id;
}

// Mengembalikan bukti dan kunci publik dari arsip.
export async function ambil(id) {
  if (!POLA_ID.test(id)) throw Error('ID arsip tidak valid.');
  const baris = await rpc('segel_ambil', { p_id: id });
  if (!baris?.length) throw Error('ID arsip tidak ditemukan.');
  const { manifest, signature, key_fp, created_at } = baris[0];
  const publicKey = await unduhBerkas(`kunci/${key_fp}.bin`);
  // Kunci dicocokkan dengan sidik jari di manifest, jadi arsip tidak bisa menyelipkan kunci lain.
  if (await sha256(publicKey) !== manifest.key) throw Error('Kunci publik di arsip tidak cocok dengan bukti.');
  return { id, bukti: { manifest, signature }, publicKey, dibuat: created_at };
}
