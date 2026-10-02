/** 音名 ⇔ 音高クラス（0=C … 11=B）の変換と、キーに応じた表記の決定。 */

const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** "C#" "Bb" "B♭" "F♯" などを音高クラスに変換する。解釈できなければ null。 */
export function noteToPc(name: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]*)$/.exec(name.trim());
  if (!m) return null;
  let pc = NATURAL_PC[m[1].toUpperCase()];
  for (const acc of m[2]) pc += acc === '#' || acc === '♯' ? 1 : -1;
  return mod12(pc);
}

/** 音高クラスを、♯系 or ♭系のどちらかで表記する。 */
export function pcToName(pc: number, preferFlats: boolean): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}

/** 表示用に ♯/♭ 記号へ置き換える（内部表記は # と b）。 */
export function prettyAccidentals(name: string): string {
  return name.replace(/#/g, '♯').replace(/(?<=^[A-G])b/g, '♭').replace(/(?<=\/[A-G])b/g, '♭');
}

export type Key = { tonic: number; minor: boolean };

/** "A" "F#m" "B♭" "Ebm" などのキー表記を解釈する。 */
export function parseKey(text: string | undefined | null): Key | null {
  if (!text) return null;
  const m = /^\s*([A-Ga-g][#♯b♭]?)\s*(m|min|minor|マイナー)?\s*$/.exec(text);
  if (!m) return null;
  const tonic = noteToPc(m[1]);
  if (tonic === null) return null;
  return { tonic, minor: Boolean(m[2]) };
}

// 調号が ♭ になるキー（長調の主音）。F, B♭, E♭, A♭, D♭, G♭
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1, 6]);

/** そのキーで ♭ 表記を使うべきか。短調は平行長調で判断する。 */
export function keyPrefersFlats(key: Key): boolean {
  const relativeMajor = key.minor ? mod12(key.tonic + 3) : key.tonic;
  return FLAT_MAJOR_TONICS.has(relativeMajor);
}

export function keyToName(key: Key): string {
  return pcToName(key.tonic, keyPrefersFlats(key)) + (key.minor ? 'm' : '');
}

export function transposeKey(key: Key, semitones: number): Key {
  return { tonic: mod12(key.tonic + semitones), minor: key.minor };
}
