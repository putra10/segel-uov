// Tekstur lak: butir halus + goresan tegak, dibuat sekali di kanvas lalu dipakai sebagai latar.
// (Gambar SVG feTurbulence sebagai latar CSS meninggalkan tepi persegi di Chrome, jadi dibuat di sini.)
// Latar guilloché untuk halaman selain beranda: pola garis kertas berharga (uang, sertifikat).
// Tiap halaman memakai keluarga kurva parametrik sendiri, digambar sebagai SVG garis tipis:
//   roset      (Sign)          cincin r(θ) = R + a·sin(mθ + kφ) dengan fase bergeser, plus pita gelombang
//   spirograf  (Verify)        hipotrokoid x = (R−r)cos t + d·cos((R−r)t/r), y = (R−r)sin t − d·sin((R−r)t/r)
//   lissajous  (Cara kerja)    x = A·sin(3t + δ), y = B·sin(2t) dengan δ bergeser
//   mawar      (About Us)      kurva mawar r = R·cos(5θ), berlapis dan diputar
export function guilloche(varian = 'roset') {
  const W = 1600, H = 1000, f = n => n.toFixed(1), jalur = [], [cx, cy] = [1150, 470];
  const kurva = (n, titik, tutup = false) => {
    let d = '';
    for (let i = 0; i <= n; i++) { const [x, y] = titik(i / n); d += (i ? 'L' : 'M') + f(x) + ' ' + f(y); }
    jalur.push(d + (tutup ? 'Z' : ''));
  };
  if (varian === 'spirograf') {
    // R/r = 8/3: (R−r)/r = 5/3, kurva tertutup setelah t = 3·2π.
    const R = 320, r = 120;
    for (let k = 0; k < 12; k++) {
      const dd = 70 + k * 12, putar = k * 0.05;
      kurva(360, u => {
        const t = u * Math.PI * 6, x = (R - r) * Math.cos(t) + dd * Math.cos(((R - r) / r) * t), y = (R - r) * Math.sin(t) - dd * Math.sin(((R - r) / r) * t);
        return [cx + x * Math.cos(putar) - y * Math.sin(putar), cy + x * Math.sin(putar) + y * Math.cos(putar)];
      }, true);
    }
  } else if (varian === 'mawar') {
    for (let k = 0; k < 18; k++) {
      const R = 420 - k * 9, putar = k * 0.035;
      kurva(240, u => { const th = u * Math.PI, r = R * Math.cos(5 * th); return [cx + r * Math.cos(th + putar), cy + r * Math.sin(th + putar)]; }, true);
    }
  } else if (varian === 'lissajous') {
    for (let k = 0; k < 16; k++) {
      const delta = k * 0.09, A = 430 - k * 6, B = 330 - k * 5;
      kurva(180, u => { const t = u * Math.PI * 2; return [cx + A * Math.sin(3 * t + delta), cy + B * Math.sin(2 * t)]; }, true);
    }
  } else {
    for (let k = 0; k < 26; k++) {
      const R = 130 + k * 11, a = 14 + (k % 3) * 4, fase = k * 0.42;
      kurva(240, u => { const th = u * Math.PI * 2, rr = R + a * Math.sin(24 * th + fase); return [cx + rr * Math.cos(th), cy + rr * Math.sin(th)]; }, true);
    }
    for (const arah of [1, -1]) for (let k = 0; k < 9; k++)
      kurva(80, u => { const x = u * W; return [x, 880 + k * 7 + arah * 26 * Math.sin(x / 70 + k * 0.5)]; });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="#f6e7d2" stroke-opacity="${varian === 'spirograf' ? '.09' : '.13'}" stroke-width=".9">${jalur.map(d => `<path d="${d}"/>`).join('')}</g></svg>`;
  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  }
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function teksturLak(ukuran = 256) {
  const k = document.createElement('canvas'); k.width = k.height = ukuran;
  // willReadFrequently menjaga kanvas di RAM CPU sehingga tidak memicu GPU readback stall di ponsel.
  const c = k.getContext('2d', { willReadFrequently: true });
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * ukuran, w = 1 + Math.random() * 8, a = 0.03 + Math.random() * 0.09, y = Math.random() * ukuran;
    const g = c.createLinearGradient(0, y - ukuran, 0, y + ukuran);
    g.addColorStop(0, 'rgba(25,0,0,0)'); g.addColorStop(0.5, `rgba(25,0,0,${a})`); g.addColorStop(1, 'rgba(25,0,0,0)');
    c.fillStyle = g;
    for (const dx of [-ukuran, 0, ukuran]) {
      // Lapisan lembut meniru blur(4px) tanpa filter GPU yang memperlambat render awal.
      c.globalAlpha = 0.35; c.fillRect(x + dx - 3, 0, w + 6, ukuran);
      c.globalAlpha = 0.65; c.fillRect(x + dx - 1, 0, w + 2, ukuran);
      c.globalAlpha = 1; c.fillRect(x + dx, 0, w, ukuran);
    }
  }
  const img = c.getImageData(0, 0, ukuran, ukuran), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = Math.random();
    if (n > 0.86) { d[i] += 255 * 0.5; d[i + 1] += 230 * 0.5; d[i + 2] += 220 * 0.5; d[i + 3] = Math.max(d[i + 3], 18); }
    else if (n < 0.1) d[i + 3] = Math.max(d[i + 3], 30);
  }
  c.putImageData(img, 0, 0);
  return new Promise(resolve => {
    if (k.toBlob) k.toBlob(b => resolve(b ? URL.createObjectURL(b) : k.toDataURL('image/png')), 'image/png');
    else resolve(k.toDataURL('image/png'));
  });
}

// Cap segel dari ~2000 titik di kanvas. Ukuran tiap titik = satu elemen GF(16) dari σ (0..15),
// jadi bentuk halftone-nya berbeda untuk setiap tanda tangan.
// Kondisi: 'proses' (redup berdenyut), 'utuh' (titik terbang masuk), 'retak' (terbelah di garis retak).
export function segelTitik(kanvas) {
  const ctx = kanvas.getContext('2d');
  const diam = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let S = 8.5; // jarak grid titik, px (sedikit lebih renggang di layar sempit)
  let W = 0, H = 0, R = 0, cx = 0, cy = 0, titik = [], nilai = new Uint8Array(160), kondisi = 'proses';
  let tetikus = { x: -1e4, y: -1e4 }, terlihat = true, raf = 0, t0 = performance.now();
  let cahayaUtuh = null, cahayaRetak = null;

  const garis = (pts) => pts.map(([x, y]) => [cx + x * R, cy + y * R]);
  function jarak(px, py, pts) {
    let m = Infinity, sisi = 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < m) { m = d; sisi = Math.sign(dx * (py - ay) - dy * (px - ax)) || 1; }
    }
    return [m, sisi];
  }

  function bangun() {
    const lama = titik; titik = [];
    const centang = garis([[-0.25, 0.01], [-0.07, 0.19], [0.27, -0.17]]);
    const retak = garis([[-1.2, -0.8], [-0.38, -0.22], [-0.52, 0.1], [0.12, 0.3], [-0.02, 0.6], [0.95, 1.1]]);
    let k = 0;
    for (let y = cy - R * 1.08; y <= cy + R * 1.08; y += S) for (let x = cx - R * 1.08; x <= cx + R * 1.08; x += S) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), rel = d / R;
      if (d > R * (1 + 0.045 * Math.cos(16 * Math.atan2(dy, dx)))) continue; // tepi lilin bergelombang
      if (rel > 0.6 && rel < 0.675) continue;                                 // cincin
      if (jarak(x, y, centang)[0] < R * 0.07) continue;                       // centang terukir
      const [dr, sisi] = jarak(x, y, retak), p = lama[k];
      titik.push({ hx: x, hy: y, x: p ? p.x : x, y: p ? p.y : y, a: p ? p.a : 0, r: p ? p.r : 0, k, sisi, celah: dr < S * 1.1, fase: Math.random() * 6.283, rel });
      k++;
    }
  }

  function ukur() {
    const kotak = kanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = kotak.width; H = kotak.height;
    S = W < 460 ? 10 : 8.5;
    kanvas.width = Math.round(W * dpr); kanvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.4; cx = W / 2; cy = H / 2;
    cahayaUtuh = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
    cahayaUtuh.addColorStop(0, 'rgba(255,214,190,0.13)'); cahayaUtuh.addColorStop(1, 'rgba(255,214,190,0)');
    cahayaRetak = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
    cahayaRetak.addColorStop(0, 'rgba(255,220,200,0.05)'); cahayaRetak.addColorStop(1, 'rgba(255,214,190,0)');
    bangun();
  }

  function tebar() { for (const p of titik) { const a = Math.random() * 6.283, d = R * (1.2 + Math.random() * 1.6); p.x = cx + Math.cos(a) * d; p.y = cy + Math.sin(a) * d; p.a = 0; } }

  function mulai() { if (!raf && terlihat && !document.hidden) { gambar.lalu = undefined; raf = requestAnimationFrame(gambar); } }
  function hentikan() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function gambar(now) {
    raf = 0;
    if (!terlihat || document.hidden) return;
    // Laju berbasis waktu: kalau bingkai jarang (laptop lambat, tab di latar), titik tetap sampai di tempatnya.
    const t = (now - t0) / 1000, dt = Math.min(1, (now - (gambar.lalu ?? now)) / 1000) || 1 / 60;
    gambar.lalu = now;
    const laju = diam ? 1 : 1 - Math.pow(0.88, dt * 60);
    const adaTetikus = tetikus.x > -1e3;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = kondisi === 'retak' ? cahayaRetak : cahayaUtuh;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = kondisi === 'retak' ? '#c9b3a8' : '#f6e7d6';
    for (const p of titik) {
      const v = nilai[p.k % 160] / 15;
      let tx = p.hx, ty = p.hy, ta, tr;
      if (kondisi === 'proses') { ta = 0.16 + 0.1 * Math.sin(t * 3 + p.fase); tr = 1.3; }
      else if (kondisi === 'redup') { ta = 0.24; tr = 1.7; } // menunggu dokumen: bayangan cap
      else if (kondisi === 'retak') {
        const g = R * 0.055;
        tx += p.sisi > 0 ? g : -g * 0.8; ty += p.sisi > 0 ? g * 0.45 : -g * 0.6;
        ta = p.celah ? 0 : 0.28 + v * 0.3; tr = 0.7 + v * S * 0.3;
      } else { ta = 0.45 + v * 0.55 - Math.max(0, p.rel - 0.9) * 2; tr = 0.7 + v * S * 0.36; }
      if (adaTetikus) {
        const mx = p.x - tetikus.x, my = p.y - tetikus.y, md = Math.hypot(mx, my);
        if (md < 80 && md > 0.01) { const dorong = (80 - md) * 0.35; tx += mx / md * dorong; ty += my / md * dorong; }
      }
      p.x += (tx - p.x) * laju; p.y += (ty - p.y) * laju; p.a += (ta - p.a) * laju; p.r += (tr - p.r) * laju;
      if (p.a < 0.01 || p.r < 0.2) continue;
      ctx.globalAlpha = Math.min(1, p.a * (0.9 + 0.1 * Math.sin(t * 1.4 + p.fase)));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(gambar);
  }

  new ResizeObserver(ukur).observe(kanvas);
  new IntersectionObserver(([e]) => { terlihat = e.isIntersecting; if (terlihat) mulai(); else hentikan(); }).observe(kanvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hentikan(); else mulai(); });
  const wadah = kanvas.parentElement;
  wadah.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const k = kanvas.getBoundingClientRect();
    tetikus = { x: e.clientX - k.left, y: e.clientY - k.top };
  });
  wadah.addEventListener('pointerleave', () => { tetikus = { x: -1e4, y: -1e4 }; });
  ukur(); mulai();

  return {
    atur(sig, k) {
      if (sig) for (let i = 0; i < 160; i++) nilai[i] = (sig[i >> 1] >> ((i & 1) * 4)) & 15;
      if (k === 'utuh' && sig && !diam) tebar();
      kondisi = k;
      mulai();
    },
  };
}
