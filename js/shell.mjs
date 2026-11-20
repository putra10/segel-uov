// Kepala, kaki, dan tema yang sama di setiap halaman.
import { teksturLak, guilloche } from './titik.mjs';

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
const BERANDA = new URL('../', import.meta.url);
const TAUTAN = [['tandatangani/', 'Sign'], ['verifikasi/', 'Verify'], ['cara-kerja/', 'Cara kerja'], ['about/', 'About Us']];

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
  const kini = location.pathname.replace(/\/index\.html$/, '/');
  const tautan = ([rute, nama]) => {
    const { pathname } = new URL(rute, BERANDA);
    return `<a href="${pathname}"${kini === pathname ? ' aria-current="page"' : ''}>${nama}</a>`;
  };
  const menu = TAUTAN.map(tautan).join('');
  const semua = tautan(['', 'Beranda']) + menu;
  document.body.insertAdjacentHTML('afterbegin', `
    <header class="kepala"><div class="wadah">
      <a href="${BERANDA.pathname}" class="logo" aria-label="${NAMA}, ke beranda">${LOGO}${NAMA}<span>UOV</span></a>
      <nav class="menu" aria-label="Menu utama">${menu}</nav>
      <div class="tema" role="group" aria-label="Tema"><button data-tema="terang" aria-label="Tema terang">${ikonTerang}</button><button data-tema="gelap" aria-label="Tema gelap">${ikonGelap}</button></div>
    </div></header>
    <nav class="menu-bawah" aria-label="Menu">${semua}</nav>`);
  document.body.insertAdjacentHTML('beforeend', `
    <footer class="kaki"><div class="wadah">
      <div class="kaki-atas">
        <a class="merek" href="${BERANDA.pathname}" aria-label="Segel, ke beranda">${LOGO}${NAMA}<span>UOV</span></a>
        <nav aria-label="Navigasi kaki halaman">${semua}</nav>
      </div>
      <div class="kaki-isi">
        <p class="slogan">Tanda tangan yang retak<br><em>kalau isinya diubah.</em></p>
        <div><h4>Proyek</h4><span class="judul-proyek">Autentikasi Suatu Tanda Tangan Digital</span><span>Pemodelan Matematika · Kelompok 3B</span><span>Dosen fasilitator: Muhammad Imran, Ph.D.</span><span>Departemen Matematika FMIPA UI</span><span>2026</span></div>
      </div>
    </div></footer>`);
  // Tekstur lak dipasang di akar supaya blok merah mana pun bisa memakainya.
  document.documentElement.style.setProperty('--tekstur', `url(${teksturLak()})`);
  // Halaman selain beranda memakai latar guilloché, bukan tekstur lak penuh.
  if (!document.body.classList.contains('beranda')) {
    const p = location.pathname, varian = p.includes('/verifikasi') ? 'spirograf' : p.includes('/cara-kerja') ? 'lissajous' : p.includes('/about') ? 'mawar' : 'roset';
    document.documentElement.style.setProperty('--guilloche', `url("${guilloche(varian)}")`);
  }

  // Lewati ke konten.
  const utama = document.querySelector('main');
  if (utama) { utama.id ||= 'isi'; document.body.insertAdjacentHTML('afterbegin', '<a class="lompat" href="#isi">Lewati ke konten</a>'); }

  const diam = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Bagian di bawah layar naik dan memudar masuk sekali. Yang sudah terlihat saat dimuat tidak disembunyikan.
  // Yang sudah dilewati (lompat lewat tautan, gulir cepat) ikut dimunculkan, jadi tak ada bagian yang tertinggal tersembunyi.
  if (!diam) {
    let tunggu = [...document.querySelectorAll('.judul-tengah, .rumus-besar, .cetak, .bagan, .tanya, .penutup .wadah, .langkah-demo')]
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
// QR hitam di atas putih dengan zona tenang 4 modul, siap dicetak atau ditempel.
export async function qrPng(teks, sel = 8, tepi = 4) {
  const q = qrcode(0, 'L'); q.addData(teks); q.make();
  const n = q.getModuleCount(), w = (n + tepi * 2) * sel, c = document.createElement('canvas');
  c.width = c.height = w;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = '#000';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect((x + tepi) * sel, (y + tepi) * sel, sel, sel);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
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
