// DOCX bertanda tangan: blok tanda tangan yang terlihat di akhir dokumen, ditambah bukti UOV
// (manifest, σ, dan kunci publik) yang disisipkan di dalam paket DOCX.
//
// Yang ditandatangani adalah "hash isi": setiap berkas di dalam paket (kecuali bagian bukti),
// diurutkan menurut nama. Jadi DOCX bisa dibuka dan diperiksa tanpa file lain, dan menyunting
// isinya di Word membuat verifikasi gagal.
// Butuh JSZip global (dimuat dari cdnjs di halaman).
import { ALGORITHM, sha256, fingerprint, shortFp, signManifest, b64, unb64 } from './protocol.mjs';

export const BAGIAN_BUKTI = 'customXml/segel-bukti.xml';
const enc = new TextEncoder();
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export const apakahDocx = (nama, bytes) => /\.docx$/i.test(nama) && bytes[0] === 0x50 && bytes[1] === 0x4b;

async function hashIsi(zip) {
  const nama = Object.keys(zip.files).filter(n => !zip.files[n].dir && n !== BAGIAN_BUKTI).sort();
  let baris = '';
  for (const n of nama) baris += n + '\0' + await sha256(await zip.file(n).async('uint8array')) + '\n';
  return sha256(enc.encode(baris));
}

function paragraf(teks, { tebal = false, warna = '5A4A45', ukuran = 18, garis = false } = {}) {
  const pPr = `<w:pPr>${garis ? '<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="8F2A24"/></w:pBdr>' : ''}<w:spacing w:before="${garis ? 360 : 0}" w:after="40"/></w:pPr>`;
  return `<w:p>${pPr}<w:r><w:rPr>${tebal ? '<w:b/>' : ''}<w:color w:val="${warna}"/><w:sz w:val="${ukuran}"/></w:rPr><w:t xml:space="preserve">${xml(teks)}</w:t></w:r></w:p>`;
}

// Sisipkan blok tanda tangan sebelum sectPr terakhir milik body (atau sebelum </w:body>).
function sisipkanBlok(dokXml, blok) {
  const akhirBody = dokXml.lastIndexOf('</w:body>');
  if (akhirBody < 0) throw Error('word/document.xml tidak punya <w:body>.');
  const sect = dokXml.lastIndexOf('<w:sectPr', akhirBody);
  const titik = sect > dokXml.lastIndexOf('</w:p>', akhirBody) ? sect : akhirBody;
  return dokXml.slice(0, titik) + blok + dokXml.slice(titik);
}

export async function tandatanganiDocx(bytes, nama, penanda, kunci, asalSitus) {
  const zip = await JSZip.loadAsync(bytes);
  const dok = zip.file('word/document.xml');
  if (!dok) throw Error('Ini bukan dokumen Word yang lengkap (word/document.xml tidak ada).');
  if (zip.file(BAGIAN_BUKTI)) throw Error('Dokumen ini sudah disegel. Segel berkas aslinya, bukan hasilnya.');

  const fp = await fingerprint(kunci.publicKey), waktu = new Date();
  const blok = paragraf('Ditandatangani secara digital dengan Segel (UOV)', { tebal: true, warna: '8F2A24', ukuran: 20, garis: true })
    + paragraf(`Penanda tangan: ${penanda}`)
    + paragraf(`Waktu: ${waktu.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`)
    + paragraf(`Sidik jari kunci: ${shortFp(fp)} …`)
    + paragraf(`Periksa keasliannya dengan membuka berkas ini di ${asalSitus}/verifikasi.html. Mengubah isi dokumen membuat tanda tangan ini tidak berlaku.`, { warna: '8A7A75', ukuran: 16 });
  zip.file('word/document.xml', sisipkanBlok(await dok.async('string'), blok));

  // Bagian bukti berekstensi .xml supaya tipe kontennya sudah dikenal Word.
  const ct = zip.file('[Content_Types].xml');
  if (ct) {
    const isi = await ct.async('string');
    if (!/Extension="xml"/i.test(isi)) zip.file('[Content_Types].xml', isi.replace(/(<Types[^>]*>)/, '$1<Default Extension="xml" ContentType="application/xml"/>'));
  }

  const manifest = { v: 1, alg: ALGORITHM, name: nama, size: 0, sha256: await hashIsi(zip), signer: penanda, at: waktu.toISOString(), key: fp, profil: 'docx-v1' };
  const bukti = await signManifest(manifest, kunci);
  zip.file(BAGIAN_BUKTI, `<?xml version="1.0" encoding="UTF-8"?>\n<segel xmlns="urn:segel:bukti:v1">${b64(enc.encode(JSON.stringify(bukti)))}</segel>`);
  const hasil = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return { hasil, bukti };
}

// null jika DOCX tidak membawa bukti Segel. isiCocok: hash isi sekarang sama dengan yang ditandatangani.
export async function bacaDocx(bytes) {
  let zip;
  try { zip = await JSZip.loadAsync(bytes); } catch { return null; }
  const bagian = zip.file(BAGIAN_BUKTI);
  if (!bagian) return null;
  const m = /<segel[^>]*>([A-Za-z0-9+/=\s]+)<\/segel>/.exec(await bagian.async('string'));
  if (!m) throw Error('Bagian bukti di dalam DOCX rusak.');
  const bukti = JSON.parse(new TextDecoder().decode(unb64(m[1].replace(/\s/g, ''))));
  if (bukti?.manifest?.profil !== 'docx-v1') throw Error('Bukti di dalam DOCX memakai format yang tidak dikenal.');
  return { bukti, isiCocok: await hashIsi(zip) === bukti.manifest.sha256 };
}
