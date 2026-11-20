// DOCX bertanda tangan: blok tanda tangan yang terlihat di akhir dokumen, ditambah bukti UOV
// (manifest, σ, dan kunci publik) yang disisipkan di dalam paket DOCX.
//
// Yang ditandatangani adalah "hash isi": setiap berkas di dalam paket (kecuali bagian bukti),
// diurutkan menurut nama. Jadi DOCX bisa dibuka dan diperiksa tanpa file lain, dan menyunting
// isinya di Word membuat verifikasi gagal.
// Butuh JSZip global (dimuat dari cdnjs di halaman).
import { ALGORITHM, sha256, fingerprint, shortFp, signManifest, b64, unb64 } from './protocol.mjs';

export const BAGIAN_BUKTI = 'customXml/segel-bukti.xml';
// Gambar QR memuat σ, jadi baru bisa dibuat setelah menandatangani. Berkas gambarnya dikecualikan
// dari hash isi (seperti bagian bukti); paragraf, relasi, dan tipe kontennya tetap ikut di-hash.
export const GAMBAR_QR = 'word/media/segel-qr.gif';
const RID_QR = 'rIdSegelQR', QR_EMU = 1371600; // 1,5 inci
const enc = new TextEncoder();
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export const apakahDocx = (nama, bytes) => /\.docx$/i.test(nama) && bytes[0] === 0x50 && bytes[1] === 0x4b;

async function hashIsi(zip) {
  const nama = Object.keys(zip.files).filter(n => !zip.files[n].dir && n !== BAGIAN_BUKTI && n !== GAMBAR_QR).sort();
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

function paragrafQR() {
  const pic = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${QR_EMU}" cy="${QR_EMU}"/><wp:docPr id="9701" name="QR verifikasi Segel"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="${pic}"><pic:pic xmlns:pic="${pic}"><pic:nvPicPr><pic:cNvPr id="9701" name="segel-qr.gif"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${RID_QR}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${QR_EMU}" cy="${QR_EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

// buatQR(bukti) -> Uint8Array GIF. Jika tidak diberikan, DOCX disegel tanpa QR.
export async function tandatanganiDocx(bytes, nama, penanda, kunci, asalSitus, buatQR = null) {
  const zip = await JSZip.loadAsync(bytes);
  const dok = zip.file('word/document.xml');
  if (!dok) throw Error('Ini bukan dokumen Word yang lengkap (word/document.xml tidak ada).');
  if (zip.file(BAGIAN_BUKTI)) throw Error('Dokumen ini sudah disegel. Segel berkas aslinya, bukan hasilnya.');

  const fp = await fingerprint(kunci.publicKey), waktu = new Date();
  const blok = paragraf('Ditandatangani secara digital dengan Segel (UOV)', { tebal: true, warna: '8F2A24', ukuran: 20, garis: true })
    + paragraf(`Penanda tangan: ${penanda}`)
    + paragraf(`Waktu: ${waktu.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`)
    + paragraf(`Sidik jari kunci: ${shortFp(fp)} …`)
    + paragraf(`Periksa keasliannya dengan ${buatQR ? 'memindai QR ini atau ' : ''}membuka berkas ini di ${asalSitus}/verifikasi/. Mengubah isi dokumen membuat tanda tangan ini tidak berlaku.`, { warna: '8A7A75', ukuran: 16 })
    + (buatQR ? paragrafQR() : '');
  zip.file('word/document.xml', sisipkanBlok(await dok.async('string'), blok));

  // Bagian bukti berekstensi .xml supaya tipe kontennya sudah dikenal Word.
  const ct = zip.file('[Content_Types].xml');
  if (ct) {
    const isi = await ct.async('string');
    if (!/Extension="xml"/i.test(isi)) zip.file('[Content_Types].xml', isi.replace(/(<Types[^>]*>)/, '$1<Default Extension="xml" ContentType="application/xml"/>'));
  }

  if (buatQR) {
    const rels = zip.file('word/_rels/document.xml.rels');
    if (!rels) throw Error('DOCX ini tidak punya word/_rels/document.xml.rels.');
    zip.file('word/_rels/document.xml.rels', (await rels.async('string')).replace('</Relationships>',
      `<Relationship Id="${RID_QR}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/segel-qr.gif"/></Relationships>`));
    const ct2 = zip.file('[Content_Types].xml'), isi2 = ct2 && await ct2.async('string');
    if (isi2 && !/Extension="gif"/i.test(isi2)) zip.file('[Content_Types].xml', isi2.replace(/(<Types[^>]*>)/, '$1<Default Extension="gif" ContentType="image/gif"/>'));
  }

  const manifest = { v: 1, alg: ALGORITHM, name: nama, size: 0, sha256: await hashIsi(zip), signer: penanda, at: waktu.toISOString(), key: fp, profil: 'docx-v1' };
  const bukti = await signManifest(manifest, kunci);
  if (buatQR) zip.file(GAMBAR_QR, buatQR(bukti));
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
