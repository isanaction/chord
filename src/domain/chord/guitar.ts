import guitarDb from '@tombatossals/chords-db/lib/guitar.json';
import { type ChordToken, isParsed, normalizeQuality, simplifyQuality } from './chord';
import { mod12 } from './pitch';

export type GuitarShape = {
  /** 6弦→1弦の順。-1 = 弾かない、0 = 開放、それ以外は baseFret からの相対フレット */
  frets: number[];
  fingers: number[];
  barres: number[];
  baseFret: number;
  midi: number[];
};

type DbChord = { key: string; suffix: string; positions: GuitarShape[] };
const chords = (guitarDb as unknown as { chords: Record<string, DbChord[]> }).chords;

// chords-db のキー名（音高クラス順）
const DB_KEYS = ['C', 'Csharp', 'D', 'Eb', 'E', 'F', 'Fsharp', 'G', 'Ab', 'A', 'Bb', 'B'];

const SUFFIX: Record<string, string> = { '': 'major', m: 'minor', '5': 'major' };

function toSuffix(normalized: string): string {
  return SUFFIX[normalized] ?? normalized;
}

/** 指定した根音と種類の押さえ方（最も基本的なもの）を返す。見つからなければテンションを省いて再検索する。 */
export function findGuitarShape(rootPc: number, quality: string): GuitarShape | null {
  const list = chords[DB_KEYS[mod12(rootPc)]];
  if (!list) return null;
  const tryFind = (q: string) => list.find((c) => c.suffix === toSuffix(q))?.positions[0] ?? null;
  return tryFind(normalizeQuality(quality)) ?? tryFind(simplifyQuality(quality));
}

/**
 * 押さえにくさの点数。開放弦中心の形 = 1、バレーやハイポジションほど高い。
 * 見つからないコードは 4（難しい扱い）。
 */
export function shapeDifficulty(shape: GuitarShape | null): number {
  if (!shape) return 4;
  let score = 1;
  if (shape.barres.length > 0) score += 2;
  if (shape.baseFret > 1) score += 1;
  const fingers = new Set(shape.fingers.filter((f) => f > 0)).size;
  if (fingers > 3) score += 0.5;
  const pressed = shape.frets.filter((f) => f > 0);
  if (pressed.length > 0 && Math.max(...pressed) - Math.min(...pressed) >= 3) score += 0.5;
  return score;
}

/** バレーなど「押さえにくい」とみなす境界 */
export const HARD_THRESHOLD = 3;

export type CapoOption = {
  capo: number;
  /** 出現回数で重み付けした押さえにくさの合計 */
  score: number;
  /** 押さえにくいコード（重複なし、表示上の名前ではなく押さえる形の根音・種類） */
  hardChords: { rootPc: number; quality: string }[];
};

/**
 * カポ 0〜maxCapo それぞれで押さえにくさを計算する（F-PLAY-04）。
 * @param tokens 譜面に出てくるコード（出現順・重複あり）
 * @param transpose 移調量（半音）
 */
export function evaluateCapos(tokens: ChordToken[], transpose: number, maxCapo = 7): CapoOption[] {
  const parsed = tokens.filter(isParsed);
  const results: CapoOption[] = [];
  for (let capo = 0; capo <= maxCapo; capo++) {
    let score = 0;
    const hard = new Map<string, { rootPc: number; quality: string }>();
    for (const t of parsed) {
      const rootPc = mod12(t.root.pc + transpose - capo);
      const d = shapeDifficulty(findGuitarShape(rootPc, t.quality));
      score += d;
      if (d >= HARD_THRESHOLD) hard.set(`${rootPc}:${normalizeQuality(t.quality)}`, { rootPc, quality: t.quality });
    }
    results.push({ capo, score, hardChords: [...hard.values()] });
  }
  return results;
}

/** 最も弾きやすいカポ位置。同点なら小さいほう。 */
export function suggestCapo(tokens: ChordToken[], transpose: number, maxCapo = 7): CapoOption {
  const options = evaluateCapos(tokens, transpose, maxCapo);
  return options.reduce((best, o) => (o.score < best.score - 1e-9 ? o : best), options[0]);
}
