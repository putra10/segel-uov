// node test-toy.mjs: cek kebenaran UOV mainan.
import assert from 'node:assert/strict';
import { V, N, keygen, sign, verify, hashToField, evalQuad, apply, isOil } from './js/uov-toy.mjs';

let retries = 0;
for (let round = 0; round < 300; round++) {
  const keys = keygen();
  for (const U of keys.F) for (let i = 0; i < N; i++) for (let j = i; j < N; j++) if (isOil(i) && isOil(j)) assert.equal(U[i][j], 0);
  assert.deepEqual(apply(keys.T, apply(keys.Tinv, [1, 2, 3, 4, 5, 6])), [1, 2, 3, 4, 5, 6]);

  const msg = 'Surat Alice No. ' + round, { t } = await hashToField(msg);
  const s = sign(keys, t);
  retries += s.attempts.length - 1;
  assert.deepEqual(keys.F.map(U => evalQuad(U, s.u)), t, 'F(u) = t');
  assert.deepEqual(verify(keys.P, s.sigma), t, 'P(σ) = t');

  const other = (await hashToField(msg + '!')).t;
  if (other.join() !== t.join()) assert.notDeepEqual(verify(keys.P, s.sigma), other, 'dokumen diubah ditolak');
}
console.log(`ok: 300 kunci, sign/verify benar, rata-rata ulang vinegar ${(retries / 300).toFixed(2)} kali (v=${V})`);
