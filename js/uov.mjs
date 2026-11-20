// UOV atas GF(16) dengan parameter tingkat 1 NIST (uov-Ip): n = 160, v = 96, o = m = 64.
// GF(16) = F_2[x]/(x^4 + x + 1). Kunci rahasia (A, F); T(v, o) = (v + A·o, o);
// pk = P = F ∘ T. Karena karakteristik 2, T⁻¹ = T.
// Target hash: SHA-256(domain ‖ pesan ‖ salt 16 byte) = 64 nibble = 64 elemen GF(16).
// Bukan format kawat liboqs dan belum diaudit: implementasi riset untuk presentasi.

export const V = 96, O = 64, N = 160;
export const PK_BYTES = O * N * (N + 1) / 4, SK_BYTES = (V * O + O * (V * (V + 1) / 2 + V * O)) / 2, SIG_BYTES = N / 2 + 16;
const VV = V * (V + 1) / 2, VO = V * O, PC = N * (N + 1) / 2;
const DOMAIN = new TextEncoder().encode('SEGEL-UOV-160-64-GF16-SHA256-v1\0');

const mul = new Uint8Array(256), inverse = new Uint8Array(16);
for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
  let x = a, y = b, z = 0;
  while (y) { if (y & 1) z ^= x; y >>= 1; x <<= 1; if (x & 16) x ^= 0b10011; }
  mul[(a << 4) | b] = z;
}
for (let a = 1; a < 16; a++) for (let b = 1; b < 16; b++) if (mul[(a << 4) | b] === 1) inverse[a] = b;

function randomNibbles(count) {
  const x = new Uint8Array(count);
  for (let i = 0; i < count; i += 65536) crypto.getRandomValues(x.subarray(i, Math.min(i + 65536, count)));
  for (let i = 0; i < count; i++) x[i] &= 15;
  return x;
}
const pack = a => Uint8Array.from({ length: a.length / 2 }, (_, i) => a[2 * i] | (a[2 * i + 1] << 4));
const unpack = a => Uint8Array.from({ length: a.length * 2 }, (_, i) => (a[i >> 1] >> ((i & 1) * 4)) & 15);
function need(a, n, name) { if (!(a instanceof Uint8Array) || a.length !== n) throw Error(`${name}: harus ${n} byte`); }

async function target(message, salt) {
  const input = new Uint8Array(DOMAIN.length + message.length + salt.length);
  input.set(DOMAIN); input.set(message, DOMAIN.length); input.set(salt, DOMAIN.length + message.length);
  return unpack(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}

// Eliminasi Gauss-Jordan atas GF(16) untuk sistem O × O; null jika singular.
function solve(a, b) {
  const rows = Array.from({ length: O }, (_, i) => { const r = new Uint8Array(O + 1); r.set(a.subarray(i * O, (i + 1) * O)); r[O] = b[i]; return r; });
  for (let c = 0; c < O; c++) {
    let p = c; while (p < O && !rows[p][c]) p++;
    if (p === O) return null;
    [rows[p], rows[c]] = [rows[c], rows[p]];
    const f = inverse[rows[c][c]];
    for (let j = c; j <= O; j++) rows[c][j] = mul[(f << 4) | rows[c][j]];
    for (let r = 0; r < O; r++) if (r !== c && rows[r][c]) {
      const g = rows[r][c];
      for (let j = c; j <= O; j++) rows[r][j] ^= mul[(g << 4) | rows[c][j]];
    }
  }
  return Uint8Array.from(rows, r => r[O]);
}

export function generateKeyPair() {
  const A = randomNibbles(V * O), F = randomNibbles(O * (VV + VO)), P = new Uint8Array(O * PC);
  for (let k = 0; k < O; k++) {
    const off = k * (VV + VO), Q = new Uint8Array(V * V), B = F.subarray(off + VV, off + VV + VO);
    let pos = off;
    for (let i = 0; i < V; i++) for (let j = i; j < V; j++) Q[i * V + j] = F[pos++];
    // C = Q·A, D = B + (Q + Qᵀ)·A
    const C = new Uint8Array(V * O), D = B.slice();
    for (let i = 0; i < V; i++) for (let j = i; j < V; j++) {
      const f = Q[i * V + j]; if (!f) continue;
      for (let t = 0; t < O; t++) {
        const z = mul[(f << 4) | A[j * O + t]];
        C[i * O + t] ^= z;
        if (i !== j) { D[i * O + t] ^= z; D[j * O + t] ^= mul[(f << 4) | A[i * O + t]]; }
      }
    }
    // Blok oil×oil publik: E = Aᵀ(Q·A + B), lalu dilipat ke segitiga atas.
    const E = new Uint8Array(O * O);
    for (let i = 0; i < V; i++) for (let a = 0; a < O; a++) {
      const f = A[i * O + a]; if (!f) continue;
      for (let b = 0; b < O; b++) E[a * O + b] ^= mul[(f << 4) | (C[i * O + b] ^ B[i * O + b])];
    }
    pos = k * PC;
    for (let i = 0; i < N; i++) for (let j = i; j < N; j++)
      P[pos++] = i < V ? (j < V ? Q[i * V + j] : D[i * O + j - V]) : (i === j ? E[(i - V) * O + j - V] : E[(i - V) * O + j - V] ^ E[(j - V) * O + i - V]);
  }
  const secret = new Uint8Array(A.length + F.length); secret.set(A); secret.set(F, A.length);
  const result = { publicKey: pack(P), secretKey: pack(secret) };
  A.fill(0); F.fill(0); secret.fill(0);
  return result;
}

export async function sign(message, secretKey) {
  need(secretKey, SK_BYTES, 'Kunci privat');
  const secret = unpack(secretKey), A = secret.subarray(0, V * O), F = secret.subarray(V * O);
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16)), h = await target(message, salt);
    for (let trial = 0; trial < 256; trial++) {
      const vin = randomNibbles(V), L = new Uint8Array(O * O), rhs = h.slice();
      for (let k = 0; k < O; k++) {
        let p = k * (VV + VO), c = 0;
        for (let i = 0; i < V; i++) for (let j = i; j < V; j++) c ^= mul[(F[p++] << 4) | mul[(vin[i] << 4) | vin[j]]];
        rhs[k] ^= c;
        for (let i = 0; i < V; i++) for (let j = 0; j < O; j++) L[k * O + j] ^= mul[(F[p++] << 4) | vin[i]];
      }
      const oil = solve(L, rhs);
      if (!oil) continue;
      const s = new Uint8Array(N); s.set(vin); s.set(oil, V);
      for (let i = 0; i < V; i++) for (let j = 0; j < O; j++) s[i] ^= mul[(A[i * O + j] << 4) | oil[j]]; // σ = T⁻¹(u) = T(u)
      const sig = new Uint8Array(SIG_BYTES); sig.set(pack(s)); sig.set(salt, N / 2);
      return sig;
    }
    throw Error('Sistem linear terus singular; coba lagi.');
  } finally { secret.fill(0); }
}

export async function verify(message, signature, publicKey) {
  need(publicKey, PK_BYTES, 'Kunci publik');
  if (!(signature instanceof Uint8Array) || signature.length !== SIG_BYTES) return false;
  const x = unpack(signature.subarray(0, N / 2)), t = await target(message, signature.subarray(N / 2)), P = unpack(publicKey);
  let diff = 0;
  for (let k = 0; k < O; k++) {
    let p = k * PC, z = 0;
    for (let i = 0; i < N; i++) { const xi = x[i]; if (!xi) { p += N - i; continue; } for (let j = i; j < N; j++) z ^= mul[(P[p++] << 4) | mul[(xi << 4) | x[j]]]; }
    diff |= z ^ t[k];
  }
  return diff === 0;
}
