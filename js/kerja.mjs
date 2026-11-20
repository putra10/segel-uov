// Web Worker: UOV nyata untuk segel langsung di beranda, supaya halaman tidak tersendat.
import * as uov from './uov.mjs';
let keys;
onmessage = async ({ data: { id, op, text, sig } }) => {
  try {
    const msg = new TextEncoder().encode(text ?? ''), t0 = performance.now();
    let res;
    if (op === 'keygen') { keys = uov.generateKeyPair(); res = true; }
    if (op === 'pasangan') res = uov.generateKeyPair(); // kunci untuk halaman Tanda tangani, dikirim balik utuh
    if (op === 'sign') res = await uov.sign(msg, keys.secretKey);
    if (op === 'verify') res = await uov.verify(msg, sig, keys.publicKey);
    postMessage({ id, res, ms: Math.round(performance.now() - t0) });
  } catch (e) { postMessage({ id, err: e.message }); }
};
