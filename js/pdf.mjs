// PDF bertanda tangan: halaman "lembar tanda tangan" ditambahkan di akhir, lalu bukti UOV
// (manifest, σ, kunci publik) ditempel sebagai pembaruan inkremental PDF yang sah.
//
// Yang ditandatangani: SHA-256 seluruh byte PDF sebelum pembaruan bukti. Penampil PDF membaca
// pembaruan itu sebagai objek biasa, jadi berkas tetap terbuka normal. Menyunting PDF lalu
// menyimpannya (menulis ulang atau menambah pembaruan) membuat verifikasi gagal.
// Butuh PDFLib global (pdf-lib dari cdnjs).
import { ALGORITHM, sha256, fingerprint, shortFp, signManifest, b64, unb64 } from './protocol.mjs';

const PENANDA = '\n%SEGEL-BUKTI-v1\n';
const latin1 = new TextDecoder('latin1'), enc = new TextEncoder();

export const apakahPdf = (nama, bytes) => /\.pdf$/i.test(nama) || latin1.decode(bytes.subarray(0, 5)) === '%PDF-';

// Teks untuk font standar PDF (WinAnsi): huruf di luar itu diganti agar tidak gagal.
const aman = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');

async function tambahLembar(bytes, penanda, waktu, fp, asalSitus) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  let pdf;
  try { pdf = await PDFDocument.load(bytes); }
  catch { throw Error('PDF ini tidak bisa dibaca, mungkin terkunci kata sandi atau rusak.'); }
  const akhir = pdf.getPage(pdf.getPageCount() - 1), { width, height } = akhir.getSize();
  const hal = pdf.addPage([width, height]);
  const biasa = await pdf.embedFont(StandardFonts.Helvetica), tebal = await pdf.embedFont(StandardFonts.HelveticaBold);
  const merah = rgb(0.56, 0.16, 0.14), abu = rgb(0.35, 0.3, 0.28), x = 56;
  let y = height - 80;
  const tulis = (t, f = biasa, ukuran = 11, warna = abu) => { hal.drawText(aman(t), { x, y, size: ukuran, font: f, color: warna, maxWidth: width - 2 * x }); y -= ukuran + 9; };
  hal.drawRectangle({ x, y: y + 22, width: width - 2 * x, height: 1.2, color: merah });
  tulis('Ditandatangani secara digital dengan Segel (UOV)', tebal, 15, merah);
  y -= 6;
  tulis(`Penanda tangan: ${penanda}`);
  tulis(`Waktu: ${waktu.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`);
  tulis(`Sidik jari kunci: ${shortFp(fp)} ...`);
  y -= 8;
  tulis(`Periksa keasliannya dengan membuka berkas ini di ${asalSitus}/verifikasi.html.`, biasa, 9.5);
  tulis('Mengubah lalu menyimpan ulang PDF ini membuat tanda tangan tidak berlaku.', biasa, 9.5);
  // Tanpa object stream supaya trailer dan xref klasik bisa dibaca untuk pembaruan inkremental.
  return pdf.save({ useObjectStreams: false });
}

function trailer(dasar) {
  const ekor = latin1.decode(dasar.subarray(Math.max(0, dasar.length - 4096)));
  const sx = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(ekor);
  const tr = ekor.lastIndexOf('trailer');
  const dict = tr >= 0 ? ekor.slice(tr) : '';
  const size = /\/Size\s+(\d+)/.exec(dict), root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(dict);
  if (!sx || !size || !root) throw Error('Struktur PDF tidak dikenali.');
  return { prev: +sx[1], size: +size[1], root: root[1] };
}

export async function tandatanganiPdf(bytes, nama, penanda, kunci, asalSitus) {
  if (latin1.decode(bytes).includes(PENANDA.trim())) throw Error('PDF ini sudah disegel. Segel berkas aslinya, bukan hasilnya.');
  const fp = await fingerprint(kunci.publicKey), waktu = new Date();
  const dasar = await tambahLembar(bytes, penanda, waktu, fp, asalSitus);
  const manifest = { v: 1, alg: ALGORITHM, name: nama, size: dasar.length, sha256: await sha256(dasar), signer: penanda, at: waktu.toISOString(), key: fp, profil: 'pdf-v1' };
  const bukti = await signManifest(manifest, kunci);

  const { prev, size, root } = trailer(dasar);
  const isi = b64(enc.encode(JSON.stringify(bukti)));
  const kepala = PENANDA, offObj = dasar.length + kepala.length;
  const obj = `${size} 0 obj\n<< /Type /SegelBukti /Length ${isi.length} >>\nstream\n${isi}\nendstream\nendobj\n`;
  const offXref = offObj + obj.length;
  const ekor = `xref\n0 1\n0000000000 65535 f \n${size} 1\n${String(offObj).padStart(10, '0')} 00000 n \ntrailer\n<< /Size ${size + 1} /Root ${root} /Prev ${prev} >>\nstartxref\n${offXref}\n%%EOF\n`;
  const tambahan = enc.encode(kepala + obj + ekor);
  const hasil = new Uint8Array(dasar.length + tambahan.length);
  hasil.set(dasar); hasil.set(tambahan, dasar.length);
  return { hasil, bukti };
}

// null jika PDF tidak membawa bukti Segel. isiCocok: byte sebelum bukti sama persis dengan yang ditandatangani,
// dan tidak ada pembaruan lain yang ditempel sesudah bukti.
export async function bacaPdf(bytes) {
  const teks = latin1.decode(bytes), i = teks.lastIndexOf(PENANDA);
  if (i < 0) return null;
  const m = /stream\n([A-Za-z0-9+/=]+)\nendstream/.exec(teks.slice(i));
  if (!m) throw Error('Bagian bukti di dalam PDF rusak.');
  const bukti = JSON.parse(new TextDecoder().decode(unb64(m[1])));
  if (bukti?.manifest?.profil !== 'pdf-v1') throw Error('Bukti di dalam PDF memakai format yang tidak dikenal.');
  const sesudah = teks.slice(i);
  const satuPembaruan = (sesudah.match(/%%EOF/g) || []).length === 1 && /%%EOF\s*$/.test(sesudah);
  const dasar = bytes.subarray(0, i);
  const isiCocok = satuPembaruan && dasar.length === bukti.manifest.size && await sha256(dasar) === bukti.manifest.sha256;
  return { bukti, isiCocok };
}
