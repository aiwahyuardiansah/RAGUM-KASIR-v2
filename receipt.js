/* ═══════════════════════════════════════════════════════════════
   RAGUM — Modul Struk Thermal
   Menghasilkan HTML struk yang siap cetak ke printer thermal
   58mm atau 80mm, ATAU disimpan sebagai gambar untuk dikirim WA.

   Dipakai bersama oleh Ragum Kasir Warung dan Ragum Kasir Toko.
   ═══════════════════════════════════════════════════════════════ */

const RECEIPT_WIDTHS = {
  '58': { mm: 58, chars: 32, pad: '4mm 3mm', font: 11.5 },
  '80': { mm: 80, chars: 48, pad: '5mm 5mm', font: 12.5 }
};

/* Bungkus teks agar rata kiri-kanan dalam lebar karakter tetap
   (nama barang di kiri, harga di kanan) — persis gaya struk asli. */
function rcLine(left, right, chars) {
  left = String(left); right = String(right);
  const space = chars - left.length - right.length;
  if (space >= 1) return left + ' '.repeat(space) + right;
  // kalau nama terlalu panjang, potong dan turunkan harga ke baris berikut
  const cut = chars - 1;
  return left.slice(0, cut) + '\n' + ' '.repeat(chars - right.length) + right;
}

function rcCenter(text, chars) {
  text = String(text);
  if (text.length >= chars) return text;
  const pad = Math.floor((chars - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function rcDivider(chars, ch = '-') { return ch.repeat(chars); }

const rrp = n => 'Rp' + Math.round(n || 0).toLocaleString('id-ID');

/**
 * Bangun isi teks struk (monospace, siap cetak thermal).
 * @param {object} o
 *   store   {name, line1, line2, phone}
 *   items   [{name, qty, price, note}]
 *   payment {method, paid, discount, taxRate, serviceRate, taxLabel}
 *   meta    {no, cashier, date, table, note}
 *   width   '58' | '80'
 */
function buildReceiptText(o) {
  const W = RECEIPT_WIDTHS[o.width || '58'];
  const c = W.chars;
  const L = [];
  const s = o.store || {};
  const m = o.meta || {};
  const p = o.payment || {};

  // ── kepala
  L.push(rcCenter((s.name || 'RAGUM KASIR').toUpperCase(), c));
  if (s.line1) L.push(rcCenter(s.line1, c));
  if (s.line2) L.push(rcCenter(s.line2, c));
  if (s.phone) L.push(rcCenter(s.phone, c));
  L.push(rcDivider(c));

  // ── info transaksi
  if (m.no)      L.push(rcLine('No', m.no, c));
  if (m.date)    L.push(rcLine('Tgl', m.date, c));
  if (m.cashier) L.push(rcLine('Kasir', m.cashier, c));
  if (m.table)   L.push(rcLine('Meja', m.table, c));
  L.push(rcDivider(c));

  // ── item
  let sub = 0;
  const wrapName = (name, width) => {
    const words = String(name).split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > width) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  (o.items || []).forEach(it => {
    const amount = it.qty * it.price;
    sub += amount;
    wrapName(it.name, c).forEach(ln => L.push(ln));
    L.push(rcLine(`  ${it.qty} x ${rrp(it.price)}`, rrp(amount), c));
    if (it.note) L.push('  * ' + it.note);
  });
  L.push(rcDivider(c));

  // ── ringkasan
  L.push(rcLine('Subtotal', rrp(sub), c));
  let total = sub;
  if (p.discount)  { L.push(rcLine('Diskon', '-' + rrp(p.discount), c)); total -= p.discount; }
  if (p.serviceRate) {
    const sv = Math.round((sub - (p.discount||0)) * p.serviceRate / 100);
    L.push(rcLine(`Layanan ${p.serviceRate}%`, rrp(sv), c)); total += sv;
  }
  if (p.taxRate) {
    const base = sub - (p.discount||0) + (p.serviceRate ? Math.round((sub-(p.discount||0))*p.serviceRate/100) : 0);
    const tax = Math.round(base * p.taxRate / 100);
    L.push(rcLine(`${p.taxLabel||'Pajak'} ${p.taxRate}%`, rrp(tax), c)); total += tax;
  }
  L.push(rcDivider(c, '='));
  L.push(rcLine('TOTAL', rrp(total), c));

  // ── pembayaran
  if (p.method) L.push(rcLine('Bayar (' + p.method + ')', rrp(p.paid ?? total), c));
  if (p.paid != null && p.method === 'Tunai') {
    L.push(rcLine('Kembali', rrp(Math.max(0, p.paid - total)), c));
  }
  L.push(rcDivider(c));

  // ── kaki
  L.push(rcCenter('Terima kasih', c));
  L.push(rcCenter('sudah berbelanja', c));
  if (m.note) { L.push(''); L.push(rcCenter(m.note, c)); }
  L.push('');
  L.push(rcCenter('· Ragum Kasir ·', c));

  return { text: L.join('\n'), total, subtotal: sub, width: W };
}

/* Render struk sebagai HTML monospace yang bisa langsung Ctrl+P
   ke printer thermal. Lebar kertas diatur lewat @page. */
function receiptHTML(o) {
  const r = buildReceiptText(o);
  const W = r.width;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Struk ${o.meta?.no||''}</title>
<style>
  @page { size: ${W.mm}mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#eceae3; display:flex; justify-content:center; padding:16px; }
  .paper {
    width:${W.mm}mm; background:#fff; padding:${W.pad};
    font-family:'Courier New',ui-monospace,monospace;
    font-size:${W.font}px; line-height:1.42; color:#111;
    white-space:pre; box-shadow:0 2px 14px rgba(0,0,0,.14);
  }
  @media print {
    body { background:none; padding:0; }
    .paper { box-shadow:none; width:auto; }
    .noprint { display:none!important; }
  }
  .bar {
    position:fixed; top:0; left:0; right:0; background:#0E7A4E; color:#fff;
    padding:10px; display:flex; gap:8px; justify-content:center; font-family:sans-serif;
  }
  .bar button { padding:8px 18px; border:none; border-radius:7px; font-weight:700;
    background:#FFD166; color:#12332a; cursor:pointer; font-size:14px; }
  .bar button.g { background:#fff; color:#0E7A4E; }
  .wrap { margin-top:52px; }
</style></head><body>
<div class="bar noprint">
  <button onclick="window.print()">Cetak Struk</button>
  <button class="g" onclick="window.close()">Tutup</button>
</div>
<div class="wrap"><div class="paper">${r.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div></div>
</body></html>`;
}

if (typeof module !== 'undefined') module.exports = { buildReceiptText, receiptHTML, RECEIPT_WIDTHS };
