// Kepala, kaki, dan tema yang sama di setiap halaman.
import { teksturLak } from './titik.mjs';

// σ sebagai 160 batang: satu batang per elemen GF(16), tinggi = nilainya (0..15).
export function batang(sig) {
  let h = '';
  for (let i = 0; i < 160; i++) {
    const v = (sig[i >> 1] >> ((i & 1) * 4)) & 15;
    h += `<i style="--h:${8 + v * 6}%;--n:${i}"></i>`;
  }
  return h;
}
export const NAMA = 'Segel';
const TAUTAN = [['tandatangani.html', 'Tanda tangani'], ['verifikasi.html', 'Verifikasi'], ['cara-kerja.html', 'Cara kerja']];

export const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:oklch(47% 0.165 22)"/><circle cx="16" cy="16" r="8.6" fill="none" style="stroke:#fff" stroke-width="1.5" stroke-dasharray="2.1 1.7"/><circle cx="16" cy="16" r="4.3" style="fill:#fff"/></svg>`;

// Cap lilin: tepi bergelombang 16 lekuk. kelas: '' (utuh), 'retak', 'proses', 'redup'.
const TEPI = Array.from({ length: 96 }, (_, i) => {
  const a = i / 96 * 2 * Math.PI, r = 28.5 + 1.7 * Math.cos(a * 16);
  return `${(32 + r * Math.cos(a)).toFixed(2)} ${(32 + r * Math.sin(a)).toFixed(2)}`;
}).join('L');
export const cap = (kelas = '') => `<svg class="cap ${kelas}" viewBox="0 0 64 64" aria-hidden="true"><path class="lilin" d="M${TEPI}Z"/><circle class="cincin" cx="32" cy="32" r="20.5"/><path class="centang" d="M24 32.5l5.5 5.5L41 26.5"/><path class="retakan" d="M12 22l13 8-5 6 11 5-3 7 14 6"/></svg>`;

const ikonTerang = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ikonGelap = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

function simpanTema(t) { try { localStorage.setItem('segel-tema', t); } catch {} }
function bacaTema() { try { return localStorage.getItem('segel-tema'); } catch { return null; } }
function pasangTema(t) {
  document.documentElement.classList.toggle('gelap', t === 'gelap');
  document.querySelectorAll('.tema button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === t)));
}

export function pasangShell() {
  const kini = location.pathname.split('/').pop() || 'index.html';
  const menu = TAUTAN.map(([h, n]) => `<a href="${h}"${kini === h ? ' aria-current="page"' : ''}>${n}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="kepala"><div class="wadah">
      <a href="index.html" class="logo" aria-label="${NAMA}, ke beranda">${LOGO}${NAMA}<span>UOV</span></a>
      <nav class="menu" aria-label="Menu utama">${menu}</nav>
      <div class="tema" role="group" aria-label="Tema"><button data-tema="terang" aria-label="Tema terang">${ikonTerang}</button><button data-tema="gelap" aria-label="Tema gelap">${ikonGelap}</button></div>
    </div></header>
    <nav class="menu-bawah" aria-label="Menu">${[['index.html', 'Beranda'], ...TAUTAN].map(([h, n]) => `<a href="${h}"${kini === h ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`);
  const luar = (href, teks) => `<a href="${href}" target="_blank" rel="noopener">${teks} ↗</a>`;
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="kaki"><div class="wadah">
      <div class="cetak" style="--kolom:4">
        <div><span class="merek">${LOGO}${NAMA}<span>UOV</span></span><p class="slogan">Tanda tangan yang retak<br><em>kalau isinya diubah.</em></p></div>
        <div><h4>Halaman</h4><a href="index.html">Beranda</a>${TAUTAN.map(([h, n]) => `<a href="${h}">${n}</a>`).join('')}</div>
        <div><h4>Proyek</h4><span>Kelompok 3B</span><span>Pemodelan Matematika</span><span>Departemen Matematika FMIPA UI</span><span>2026</span></div>
        <div><h4>Rujukan</h4>${luar('https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/uov-spec-round2-web.pdf', 'Spesifikasi UOV v2.0')}${luar('https://doi.org/10.1007/3-540-48910-X_15', 'Kipnis, Patarin &amp; Goubin (1999)')}${luar('https://doi.org/10.6028/NIST.IR.8610', 'NIST IR 8610')}</div>
      </div>
      <div class="kaki-bawah">
        <span>Prototipe riset. Implementasi UOV ini belum diaudit, jadi jangan dipakai untuk dokumen resmi.</span>
        <span>Parameter UOV tingkat 1 NIST · berjalan di browser</span>
      </div>
    </div></footer>`);
  // Tekstur lak dipasang di akar supaya blok merah mana pun bisa memakainya.
  document.documentElement.style.setProperty('--tekstur', `url(${teksturLak()})`);

  // Lewati ke konten.
  const utama = document.querySelector('main');
  if (utama) { utama.id ||= 'isi'; document.body.insertAdjacentHTML('afterbegin', '<a class="lompat" href="#isi">Lewati ke konten</a>'); }

  const diam = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Bagian di bawah layar naik dan memudar masuk sekali. Yang sudah terlihat saat dimuat tidak disembunyikan.
  // Yang sudah dilewati (lompat lewat tautan, gulir cepat) ikut dimunculkan, jadi tak ada bagian yang tertinggal tersembunyi.
  if (!diam) {
    let tunggu = [...document.querySelectorAll('.judul-tengah, .rumus-besar, .cetak, .bagan, .tanya, .penutup .wadah, .langkah-demo, .kaki .cetak')]
      .filter(el => el.getBoundingClientRect().top > innerHeight * 0.9);
    tunggu.forEach(el => el.classList.add('akan-muncul'));
    let dijadwal = false;
    const periksa = () => {
      dijadwal = false;
      tunggu = tunggu.filter(el => { const lewat = el.getBoundingClientRect().top < innerHeight * 0.9; if (lewat) el.classList.add('muncul'); return !lewat; });
      if (!tunggu.length) removeEventListener('scroll', jadwalkan);
    };
    const jadwalkan = () => { if (!dijadwal) { dijadwal = true; requestAnimationFrame(periksa); } };
    addEventListener('scroll', jadwalkan, { passive: true });
  }

  // Kalimat besar: tiap kata menyala saat melewati garis 65% tinggi layar. Kata di <em> diberi warna aksen.
  const slogan = document.querySelector('.slogan-besar p');
  if (slogan) {
    const kata = [];
    slogan.innerHTML = [...slogan.childNodes].map(n => {
      const aksen = n.nodeName === 'EM';
      return n.textContent.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : `<span class="kata${aksen ? ' aksen' : ''}">${w}</span>`).join('');
    }).join('');
    kata.push(...slogan.querySelectorAll('.kata'));
    let jadwal = false;
    const nyalakan = () => { jadwal = false; const garis = innerHeight * 0.65; kata.forEach(k => k.classList.toggle('nyala', diam || k.getBoundingClientRect().top < garis)); };
    addEventListener('scroll', () => { if (!jadwal) { jadwal = true; requestAnimationFrame(nyalakan); } }, { passive: true });
    nyalakan();
  }
  pasangTema(bacaTema() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang'));
  document.querySelectorAll('.tema button').forEach(b => b.onclick = () => { pasangTema(b.dataset.tema); simpanTema(b.dataset.tema); });
  const kepala = document.querySelector('.kepala'), cek = () => kepala.classList.toggle('bergulir', scrollY > 4);
  addEventListener('scroll', cek, { passive: true }); cek();
}

// Utilitas kecil yang dipakai halaman aplikasi.
export const ukuran = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1).replace('.', ',') + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function unduh(nama, isi, tipe = 'application/octet-stream') {
  const u = URL.createObjectURL(new Blob([isi], { type: tipe })), a = document.createElement('a');
  a.href = u; a.download = nama; a.click(); setTimeout(() => URL.revokeObjectURL(u), 10000);
}
export const ekstensi = nama => (nama.split('.').pop() || 'file').slice(0, 4);
// Zona jatuh: klik atau seret berkas. cb(file) dipanggil saat berkas dipilih.
export function zonaJatuh(el, cb) {
  const input = el.querySelector('input');
  input.onchange = () => input.files[0] && cb(input.files[0]);
  el.ondragover = e => { e.preventDefault(); el.classList.add('di-atas'); };
  el.ondragleave = () => el.classList.remove('di-atas');
  el.ondrop = e => { e.preventDefault(); el.classList.remove('di-atas'); e.dataTransfer.files[0] && cb(e.dataTransfer.files[0]); };
}
