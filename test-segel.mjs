// node test-segel.mjs: cek mesin UOV nyata + format bukti.
import assert from 'node:assert/strict';
import * as uov from './js/uov.mjs';
import { signFile, check, toToken, fromToken, unb64 } from './js/protocol.mjs';

assert.equal(uov.PK_BYTES, 412160); assert.equal(uov.SIG_BYTES, 96);
const keys = uov.generateKeyPair(), other = uov.generateKeyPair();
assert.equal(keys.publicKey.length, uov.PK_BYTES); assert.equal(keys.secretKey.length, uov.SK_BYTES);

const msg = new TextEncoder().encode('halo');
for (let i = 0; i < 5; i++) assert.ok(await uov.verify(msg, await uov.sign(msg, keys.secretKey), keys.publicKey));
const sig = await uov.sign(msg, keys.secretKey);
assert.equal(await uov.verify(new TextEncoder().encode('hal0'), sig, keys.publicKey), false, 'pesan diubah');
assert.equal(await uov.verify(msg, sig, other.publicKey), false, 'kunci lain');
const bent = sig.slice(); bent[3] ^= 1;
assert.equal(await uov.verify(msg, bent, keys.publicKey), false, 'σ diubah');

const file = new TextEncoder().encode('SK Dekan No. 12/2026');
const proof = await signFile(file, 'sk.pdf', 'Dekan FMIPA', keys);
const pk = unb64(proof.publicKey);
let r = await check({ ...proof, publicKey: pk, fileBytes: file });
assert.deepEqual([r.signatureValid, r.fileMatches, r.trusted], [true, true, null]);
r = await check({ ...proof, publicKey: pk, fileBytes: new TextEncoder().encode('SK Dekan No. 22/2026') });
assert.deepEqual([r.signatureValid, r.fileMatches], [true, false], 'file diubah terdeteksi');
r = await check({ ...proof, manifest: { ...proof.manifest, signer: 'Orang lain' }, publicKey: pk, fileBytes: file });
assert.equal(r.signatureValid, false, 'nama penanda tangan diubah');
r = await check({ ...proof, publicKey: other.publicKey, fileBytes: file });
assert.deepEqual([r.keyMatches, r.signatureValid], [false, false], 'kunci publik ditukar');
r = await check({ ...proof, publicKey: pk, fileBytes: file, trustedFp: r.fingerprint.slice(0, 16) });
assert.equal(r.trusted, false, 'fingerprint kunci lain tidak dipercaya');
r = await check({ ...proof, publicKey: pk, fileBytes: file, trustedFp: proof.manifest.key.slice(0, 16) });
assert.equal(r.trusted, true);

const tok = fromToken(toToken(proof));
r = await check({ ...tok, publicKey: pk, fileBytes: file });
assert.deepEqual([r.signatureValid, r.fileMatches], [true, true], 'jalur QR');
console.log(`ok: UOV-Ip sign/verify, bukti, token QR (${toToken(proof).length} karakter)`);
