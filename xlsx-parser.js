// ============================================================
// XLSX Parser - Reads ZIP Central Directory (reliable for all XLSX)
// ============================================================

async function xlsxToRows(buffer) {
  const bytes = new Uint8Array(buffer);
  
  // 1. Find End of Central Directory (EOCD) - search from end
  const eocd = findEOCD(bytes);
  if (!eocd) throw new Error('ZIP yapısı bulunamadı');

  // 2. Read Central Directory entries
  const entries = readCentralDirectory(bytes, eocd);

  // 3. Decompress needed files
  const files = {};
  for (const entry of entries) {
    const n = entry.filename;
    if (/xl\/sharedstrings\.xml$/i.test(n) || /xl\/worksheets\/sheet1\.xml$/i.test(n)) {
      try { files[n] = await decompressEntry(bytes, entry); } catch(e) { console.warn('Skip', n, e.message); }
    }
  }

  // 4. Parse XML
  const ssKey = Object.keys(files).find(k => /sharedstrings/i.test(k));
  const sharedStrings = ssKey ? parseSharedStrings(files[ssKey]) : [];
  
  const sheetKey = Object.keys(files).find(k => /sheet1\.xml$/i.test(k));
  if (!sheetKey) throw new Error('Sheet1 bulunamadı');
  
  const allRows = parseSheet(files[sheetKey], sharedStrings);
  
  // 5. Auto-detect real header row (find row containing known Turkish column names)
  const HEADER_KEYWORDS = ['STOK', 'UYGULAMA', 'YAYINEVİ', 'YAYINEVI', 'DENEME', 'DÜZEY', 'DUZEY', 'KAPSAM', 'KATEGORI'];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const rowUpper = allRows[i].map(v => (v||'').toString().toUpperCase().replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C'));
    const matches = HEADER_KEYWORDS.filter(k => rowUpper.some(cell => cell.includes(k)));
    if (matches.length >= 2) { headerRowIdx = i; break; }
  }
  
  // Return from header row onwards, skip fully empty rows
  return allRows.slice(headerRowIdx).filter(r => r.some(v => v !== ''));
}

function findEOCD(bytes) {
  // EOCD signature: PK\x05\x06 = 0x06054b50
  // Search backwards from end (comment can be up to 65535 bytes)
  const sig = [0x50, 0x4B, 0x05, 0x06];
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes[i]===sig[0] && bytes[i+1]===sig[1] && bytes[i+2]===sig[2] && bytes[i+3]===sig[3]) {
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      return {
        cdOffset: view.getUint32(i + 16, true),
        cdSize:   view.getUint32(i + 12, true),
        cdCount:  view.getUint16(i + 8,  true),
      };
    }
  }
  return null;
}

function readCentralDirectory(bytes, eocd) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const entries = [];
  let pos = eocd.cdOffset;
  
  for (let i = 0; i < eocd.cdCount; i++) {
    if (pos + 46 > bytes.length) break;
    // Central directory signature: PK\x01\x02
    if (view.getUint32(pos, true) !== 0x02014B50) break;
    
    const compression  = view.getUint16(pos + 10, true);
    const compSize     = view.getUint32(pos + 20, true);
    const uncompSize   = view.getUint32(pos + 24, true);
    const nameLen      = view.getUint16(pos + 28, true);
    const extraLen     = view.getUint16(pos + 30, true);
    const commentLen   = view.getUint16(pos + 32, true);
    const localOffset  = view.getUint32(pos + 42, true);
    const filename     = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
    
    entries.push({ filename, compression, compSize, uncompSize, localOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function decompressEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const lh = entry.localOffset;
  
  // Local file header: PK\x03\x04
  if (view.getUint32(lh, true) !== 0x04034B50) throw new Error('Bad local header');
  
  const nameLen  = view.getUint16(lh + 26, true);
  const extraLen = view.getUint16(lh + 28, true);
  const dataStart = lh + 30 + nameLen + extraLen;
  const compData  = bytes.slice(dataStart, dataStart + entry.compSize);
  
  if (entry.compression === 0) {
    // Stored
    return new TextDecoder('utf-8', { fatal: false }).decode(compData);
  }
  
  if (entry.compression === 8) {
    // Deflate
    const ds     = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    
    writer.write(compData);
    writer.close();
    
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return new TextDecoder('utf-8', { fatal: false }).decode(out);
  }
  
  throw new Error(`Desteklenmeyen sıkıştırma: ${entry.compression}`);
}

function parseSharedStrings(xml) {
  const result = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const texts = [...si[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(m => m[1]);
    result.push(
      texts.join('')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    );
  }
  return result;
}

function xlsxColToIndex(col) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxSerialToDate(serial) {
  const d = new Date((serial - 25569) * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  for (const rowM of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rowM[1].matchAll(/<c\s([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs  = cm[1];
      const inner  = cm[2];
      const ref    = attrs.match(/r="([A-Z]+)\d+"/)?.[1] || '';
      const colIdx = ref ? xlsxColToIndex(ref) : cells.length;
      while (cells.length < colIdx) cells.push('');
      
      const t   = attrs.match(/t="([^"]*)"/)?.[1] || '';
      const val = inner.match(/<v>([^<]*)<\/v>/)?.[1] || '';
      
      if (t === 's') {
        cells.push(sharedStrings[parseInt(val)] ?? '');
      } else if (t === 'inlineStr' || t === 'str') {
        cells.push(inner.match(/<t[^>]*>([^<]*)<\/t>/)?.[1] ?? '');
      } else if (val !== '') {
        const num = parseFloat(val);
        // Date serials: between 1900-01-01 and 2200-01-01, integer
        if (!isNaN(num) && num > 25569 && num < 109574 && Number.isInteger(num)) {
          cells.push(xlsxSerialToDate(num));
        } else {
          cells.push(val);
        }
      } else {
        cells.push('');
      }
    }
    if (cells.some(v => v !== '')) rows.push(cells);
  }
  return rows;
}
