import fonts from 'pdfmake/build/vfs_fonts';

// The four bundled Roboto faces share the same BMP cmap. Read the regular
// face so the fallback follows the bundled font without another dependency.
function robotoCoverage() {
  const bytes = Uint8Array.from(atob(fonts['Roboto-Regular.ttf']), char => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const coverage = new Set<number>();
  for (let table = 12; table < 12 + 16 * view.getUint16(4); table += 16) {
    if (view.getUint32(table) !== 0x636d6170) continue; // cmap
    const cmap = view.getUint32(table + 8);
    for (let entry = cmap + 4; entry < cmap + 4 + 8 * view.getUint16(cmap + 2); entry += 8) {
      const platform = view.getUint16(entry);
      if (platform !== 0 && !(platform === 3 && view.getUint16(entry + 2) === 1)) continue;
      const subtable = cmap + view.getUint32(entry + 4);
      if (view.getUint16(subtable) !== 4) continue;
      const segments = view.getUint16(subtable + 6) / 2;
      const ends = subtable + 14;
      const starts = ends + segments * 2 + 2;
      for (let segment = 0; segment < segments; segment++) {
        const offset = segment * 2;
        const start = view.getUint16(starts + offset);
        const end = view.getUint16(ends + offset);
        const delta = view.getInt16(starts + segments * 2 + offset);
        const pointer = starts + segments * 4 + offset;
        const range = view.getUint16(pointer);
        for (let code = start; code <= end && code < 0xffff; code++) {
          const glyph = range ? view.getUint16(pointer + range + (code - start) * 2) : code;
          if ((!range || glyph) && ((glyph + delta) & 0xffff)) coverage.add(code);
        }
      }
      return coverage;
    }
  }
  return coverage;
}

let coverage: Set<number> | undefined;
const symbolFallbacks: Record<string, string> = { '→': '->', '←': '<-', '↑': '^', '↓': 'v', '↔': '<->', '⇒': '=>' };

export function notebookPdfText(text: string) {
  return text.normalize('NFC').replace(/[^\x20-\x7e\r\n\t]/gu, char => {
    const code = char.codePointAt(0)!;
    coverage ??= robotoCoverage();
    return coverage.has(code) ? char : symbolFallbacks[char] ?? `[U+${code.toString(16).toUpperCase()}]`;
  });
}
