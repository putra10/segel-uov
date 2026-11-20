// UOV mainan atas F_7: v = 4 vinegar, o = m = 2 oil, n = 6.
// Bentuk kunci mengikuti spesifikasi UOV: F rahasia (blok oil×oil nol),
// T = [[I, A], [0, I]] sehingga T⁻¹ = [[I, −A], [0, I]], dan P = F ∘ T.
// ponytail: parameter edukatif, bukan aman. Mode nyata memakai GF(16), n=160, m=64.

export const Q = 7, V = 4, O = 2, N = V + O, M = O;

export const mod = x => ((x % Q) + Q) % Q;
const inv = a => { for (let b = 1; b < Q; b++) if (mod(a * b) === 1) return b; throw Error('tidak punya invers'); };

export function randElem() {
  const b = new Uint8Array(1);
  do crypto.getRandomValues(b); while (b[0] >= 252); // 252 = 36·7, tanpa bias
  return b[0] % Q;
}

const zeros = (r, c) => Array.from({ length: r }, () => Array(c).fill(0));
const identity = n => zeros(n, n).map((row, i) => row.map((_, j) => +(i === j)));
const mul = (X, Y) => X.map(row => Y[0].map((_, j) => mod(row.reduce((s, x, k) => s + x * Y[k][j], 0))));
const transpose = X => X[0].map((_, j) => X.map(row => row[j]));
export const apply = (X, x) => X.map(row => mod(row.reduce((s, a, k) => s + a * x[k], 0)));

// Matriks bentuk kuadratik penuh -> segitiga atas (koefisien suku x_i x_j, i ≤ j).
const upper = X => X.map((row, i) => row.map((_, j) => (j < i ? 0 : j === i ? X[i][i] : mod(X[i][j] + X[j][i]))));

export const isOil = i => i >= V;

export function evalQuad(U, x) {
  let s = 0;
  for (let i = 0; i < N; i++) for (let j = i; j < N; j++) s += U[i][j] * x[i] * x[j];
  return mod(s);
}

export function keygen() {
  const F = Array.from({ length: M }, () => {
    const U = zeros(N, N);
    for (let i = 0; i < N; i++) for (let j = i; j < N; j++) if (!(isOil(i) && isOil(j))) U[i][j] = randElem();
    return U;
  });
  const A = Array.from({ length: V }, () => Array.from({ length: O }, randElem));
  const T = identity(N), Tinv = identity(N);
  for (let i = 0; i < V; i++) for (let j = 0; j < O; j++) { T[i][V + j] = A[i][j]; Tinv[i][V + j] = mod(-A[i][j]); }
  const P = F.map(U => upper(mul(transpose(T), mul(U, T)))); // P(x) = F(Tx) = xᵀ(TᵀUT)x
  return { F, A, T, Tinv, P };
}

// H : {0,1}* -> F_7^2. SHA-256 dulu, lalu dua bilangan 16-bit dipetakan mod 7.
export async function hashToField(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const t = Array.from({ length: M }, (_, k) => mod((bytes[2 * k] << 8) | bytes[2 * k + 1]));
  return { hex, t };
}

// Setelah vinegar dipilih, F_k(v, o) = c_k + Σ L_kj o_j: linear terhadap oil.
export function linearize(F, vin) {
  return F.map(U => {
    let c = 0;
    for (let i = 0; i < V; i++) for (let j = i; j < V; j++) c += U[i][j] * vin[i] * vin[j];
    const L = Array.from({ length: O }, (_, j) => mod(vin.reduce((s, vi, i) => s + U[i][V + j] * vi, 0)));
    return { c: mod(c), L };
  });
}

export function sign(keys, t, maxTries = 64) {
  const attempts = [];
  for (let k = 0; k < maxTries; k++) {
    const vin = Array.from({ length: V }, randElem);
    const rows = linearize(keys.F, vin), rhs = rows.map((r, i) => mod(t[i] - r.c));
    const [[a, b], [c, d]] = rows.map(r => r.L), det = mod(a * d - b * c);
    attempts.push({ vin, rows, rhs, det });
    if (!det) continue;
    const di = inv(det), oil = [mod(di * (d * rhs[0] - b * rhs[1])), mod(di * (a * rhs[1] - c * rhs[0]))];
    const u = [...vin, ...oil];
    return { attempts, vin, oil, u, sigma: apply(keys.Tinv, u) };
  }
  throw Error('Sistem linear selalu singular; acak ulang kunci.');
}

export const verify = (P, sigma) => P.map(U => evalQuad(U, sigma));
