// Format bukti Segel. Yang ditandatangani bukan file mentah, tetapi manifest kanonik
// yang memuat SHA-256 file, sehingga nama penanda tangan, waktu, dan kunci ikut terikat.
import * as uov from './uov.mjs';

export const ALGORITHM = 'Segel-UOV-Ip-GF16-SHA256-v1';
const enc = new TextEncoder(), dec = new TextDecoder();

export const hex = a => Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
export const sha256 = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
export function b64(a) { let s = ''; for (let i = 0; i < a.length; i += 16384) s += String.fromCharCode(...a.subarray(i, i + 16384)); return btoa(s); }
export function unb64(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw Error('Base64 tidak valid');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
const b64url = a => b64(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

export const fingerprint = async publicKey => sha256(publicKey);
export const shortFp = fp => fp.slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');

// Urutan kunci tetap: inilah byte yang ditandatangani dan diverifikasi.
export function canonical(m) {
  if (!m || m.v !== 1 || m.alg !== ALGORITHM) throw Error('Format bukti tidak dikenal');
  const ok = /^[a-f0-9]{64}$/.test(m.sha256) && /^[a-f0-9]{64}$/.test(m.key) && Number.isSafeInteger(m.size) && m.size >= 0
    && typeof m.name === 'string' && m.name.length <= 255 && typeof m.signer === 'string' && m.signer.length <= 120
    && typeof m.at === 'string' && Number.isFinite(Date.parse(m.at));
  if (!ok || (m.profil !== undefined && !['docx-v1', 'pdf-v1'].includes(m.profil))) throw Error('Isi manifest tidak valid');
  const isi = { v: 1, alg: ALGORITHM, name: m.name, size: m.size, sha256: m.sha256, signer: m.signer, at: m.at, key: m.key };
  // Profil docx-v1: sha256 adalah hash isi paket DOCX (tanpa bagian bukti), bukan hash file mentah.
  if (m.profil) isi.profil = m.profil;
  return enc.encode(JSON.stringify(isi));
}

export async function signManifest(manifest, keys) {
  const signature = await uov.sign(canonical(manifest), keys.secretKey);
  return { manifest, publicKey: b64(keys.publicKey), signature: b64(signature) };
}

export async function signFile(fileBytes, fileName, signer, keys) {
  return signManifest({ v: 1, alg: ALGORITHM, name: fileName, size: fileBytes.length, sha256: await sha256(fileBytes), signer, at: new Date().toISOString(), key: await fingerprint(keys.publicKey) }, keys);
}

// Token QR: manifest + σ tanpa kunci publik (412 KB tidak muat di QR).
export const toToken = proof => b64url(enc.encode(JSON.stringify({ m: proof.manifest, s: proof.signature })));
export function fromToken(token) {
  const x = JSON.parse(dec.decode(unb64url(token)));
  canonical(x.m);
  return { manifest: x.m, signature: x.s };
}

// Hasil per pemeriksaan: true / false / null (belum bisa diperiksa).
export async function check({ manifest, signature, publicKey, fileBytes, trustedFp }) {
  const msg = canonical(manifest), pk = publicKey ?? null, sig = unb64(signature);
  const fp = pk ? await fingerprint(pk) : null;
  const keyMatches = pk ? fp === manifest.key : null;
  const signatureValid = pk ? keyMatches && await uov.verify(msg, sig, pk) : null;
  const fileMatches = fileBytes ? fileBytes.length === manifest.size && await sha256(fileBytes) === manifest.sha256 : null;
  const t = (trustedFp || '').replace(/\s/g, '').toLowerCase();
  const trusted = t.length >= 16 ? !!fp && fp.startsWith(t) : null; // < 16 karakter: belum dinilai
  return { signatureValid, keyMatches, fileMatches, trusted, fingerprint: fp ?? manifest.key };
}
