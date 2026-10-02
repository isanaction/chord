import { findGuitarShape } from '@/domain/chord/guitar';
import { chordPitchClasses } from '@/domain/chord/notes';
import { mod12 } from '@/domain/chord/pitch';

type DiagramProps = { rootPc: number; quality: string; bassPc?: number };

const STRING_X = (i: number) => 6 + i * 8;
const FRET_Y = (f: number) => 12 + f * 11;

/** ギターのコード図（6弦が左） */
export function GuitarDiagram({ rootPc, quality }: DiagramProps) {
  const shape = findGuitarShape(rootPc, quality);
  if (!shape) {
    return (
      <svg width="52" height="60" viewBox="0 0 52 60" aria-hidden="true">
        <text x="26" y="34" textAnchor="middle" fontSize="9" fill="var(--text-3)">
          図なし
        </text>
      </svg>
    );
  }
  const barreSpans = shape.barres.map((fret) => {
    const covered = shape.frets.map((f, i) => (f === fret ? i : -1)).filter((i) => i >= 0);
    return { fret, from: Math.min(...covered), to: Math.max(...covered) };
  });
  return (
    <svg width="52" height="60" viewBox="0 0 52 60" aria-hidden="true">
      {shape.baseFret > 1 && (
        <text x="0" y={FRET_Y(0.5) + 3} fontSize="8" fill="var(--text-2)">
          {shape.baseFret}
        </text>
      )}
      {[0, 1, 2, 3, 4].map((f) => (
        <line
          key={f}
          x1={STRING_X(0)}
          x2={STRING_X(5)}
          y1={FRET_Y(f)}
          y2={FRET_Y(f)}
          stroke={f === 0 && shape.baseFret === 1 ? 'var(--text)' : 'var(--diagram)'}
          strokeWidth={f === 0 && shape.baseFret === 1 ? 2.5 : 1}
        />
      ))}
      {shape.frets.map((_, i) => (
        <line key={i} x1={STRING_X(i)} x2={STRING_X(i)} y1={FRET_Y(0)} y2={FRET_Y(4)} stroke="var(--diagram)" strokeWidth={1} />
      ))}
      {shape.frets.map((f, i) =>
        f === -1 ? (
          <text key={i} x={STRING_X(i)} y={8} textAnchor="middle" fontSize="7" fill="var(--text-3)">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={i} cx={STRING_X(i)} cy={5.5} r={2.2} fill="none" stroke="var(--text-2)" strokeWidth={1} />
        ) : null,
      )}
      {barreSpans.map((b) => (
        <rect
          key={b.fret}
          x={STRING_X(b.from) - 3.5}
          y={FRET_Y(b.fret - 0.5) - 3.5}
          width={STRING_X(b.to) - STRING_X(b.from) + 7}
          height={7}
          rx={3.5}
          fill="var(--text)"
        />
      ))}
      {shape.frets.map((f, i) =>
        f > 0 && !shape.barres.includes(f) ? <circle key={i} cx={STRING_X(i)} cy={FRET_Y(f - 0.5)} r={3.5} fill="var(--text)" /> : null,
      )}
    </svg>
  );
}

// 1オクターブ内の白鍵の位置（0〜6）と黒鍵の位置（白鍵の境目）
const WHITE_INDEX: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
const BLACK_AFTER: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

/** 鍵盤のコード図（根音から上に積んだ構成音を2オクターブで表示） */
export function PianoDiagram({ rootPc, quality, bassPc }: DiagramProps) {
  const pcs = chordPitchClasses(rootPc, quality);
  // 根音を最初のオクターブに置き、残りを順に上へ積む
  const notes: number[] = [];
  let prev = -1;
  for (const pc of pcs) {
    let n = mod12(pc);
    while (n <= prev) n += 12;
    notes.push(n);
    prev = n;
  }
  const lit = new Set(notes.filter((n) => n < 24));
  const bass = bassPc !== undefined ? mod12(bassPc) : null;
  const W = 7;
  const whites: { x: number; n: number }[] = [];
  const blacks: { x: number; n: number }[] = [];
  for (let oct = 0; oct < 2; oct++) {
    for (let pc = 0; pc < 12; pc++) {
      const n = oct * 12 + pc;
      if (pc in WHITE_INDEX) whites.push({ x: (oct * 7 + WHITE_INDEX[pc]) * W, n });
      else blacks.push({ x: (oct * 7 + BLACK_AFTER[pc]) * W + W - 2.5, n });
    }
  }
  const fill = (n: number, base: string) => (lit.has(n) ? 'var(--accent-fill)' : bass !== null && n === bass ? 'var(--text-3)' : base);
  return (
    <svg width={14 * W + 1} height="40" viewBox={`0 0 ${14 * W + 1} 40`} aria-hidden="true">
      {whites.map((k) => (
        <rect key={k.n} x={k.x + 0.5} y={0.5} width={W} height={39} rx={1.5} fill={fill(k.n, 'var(--text)')} stroke="var(--bg)" />
      ))}
      {blacks.map((k) => (
        <rect key={k.n} x={k.x} y={0.5} width={5} height={24} rx={1} fill={fill(k.n, 'var(--surface-2)')} stroke="var(--bg)" />
      ))}
    </svg>
  );
}
