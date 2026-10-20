import type { ChordToken } from '@/domain/chord/chord';
import type { Line, SheetBody } from '@/domain/sheet/types';

/** 練習中の表示（動画同期・記録・ループ） */
export type PracticeMarks = {
  /** 動画の再生位置で演奏中の行 */
  activeLineId?: string | null;
  /** 記録モードで、次に時刻を記録する行 */
  pendingLineId?: string | null;
  /** 記録モードで表示する、行ごとの時刻 */
  lineTimes?: Map<string, string>;
  /** ループ中のセクション */
  loopSectionId?: string | null;
  onLineClick?: (lineId: string) => void;
  onSectionClick?: (sectionId: string) => void;
};

type Props = {
  body: SheetBody;
  format: (token: ChordToken) => string;
  /** 文字サイズの倍率 */
  scale?: number;
  compact?: boolean;
  practice?: PracticeMarks;
};

/** 歌詞とコードを揃えて表示する（F-VIEW-01）。 */
export function SheetView({ body, format, scale = 1, compact = false, practice }: Props) {
  const base = (compact ? 14 : 17) * scale;
  return (
    <div className="flex flex-col" style={{ gap: base * 0.9, fontSize: base }}>
      {body.sections.map((section) => {
        const looping = practice?.loopSectionId === section.id;
        return (
          <section key={section.id} aria-label={section.label || undefined} className="flex flex-col gap-0.5">
            {section.label &&
              (practice?.onSectionClick ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    practice.onSectionClick?.(section.id);
                  }}
                  aria-pressed={looping}
                  aria-label={`${section.label}${looping ? '（ループ中。押すと解除）' : 'をループする'}`}
                  className={`flex items-center gap-2 self-start rounded-lg px-3 pb-1 text-[0.72em] font-bold tracking-wider ${looping ? 'text-accent' : 'text-text-2'}`}
                >
                  {section.label}
                  <span className={`rounded-full border px-1.5 text-[0.85em] font-medium tracking-normal ${looping ? 'border-accent-border bg-accent-soft' : 'border-line'}`}>
                    {looping ? 'ループ中' : 'ループ'}
                  </span>
                </button>
              ) : (
                <h3 className="px-3 pb-1 text-[0.72em] font-bold tracking-wider text-text-2">{section.label}</h3>
              ))}
            {section.lines.map((line) => (
              <LineFrame key={line.id} line={line} practice={practice}>
                <SheetLine line={line} format={format} />
              </LineFrame>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function LineFrame({ line, practice, children }: { line: Line; practice?: PracticeMarks; children: React.ReactNode }) {
  if (!practice || line.kind === 'comment') return <>{children}</>;
  const active = practice.activeLineId === line.id;
  const pending = practice.pendingLineId === line.id;
  const time = practice.lineTimes?.get(line.id);
  const clickable = Boolean(practice.onLineClick);
  return (
    <div
      data-line-id={line.id}
      aria-current={active ? 'true' : undefined}
      onClick={
        clickable
          ? (e) => {
              e.stopPropagation();
              practice.onLineClick?.(line.id);
            }
          : undefined
      }
      className={`relative rounded-xl transition-colors ${active ? 'bg-accent-soft' : ''} ${
        pending ? 'outline-2 outline-offset-[-2px] outline-accent-border outline-dashed' : ''
      } ${clickable ? 'cursor-pointer' : ''}`}
    >
      {children}
      {practice.lineTimes && (
        <span className="pointer-events-none absolute top-1 right-2 font-chord text-[0.62em] text-text-3">{time ?? '—'}</span>
      )}
    </div>
  );
}

function SheetLine({ line, format }: { line: Line; format: Props['format'] }) {
  if (line.kind === 'comment') {
    return <p className="px-3 py-1 text-[0.8em] text-text-2">{line.text}</p>;
  }
  if (line.kind === 'bars') {
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5 font-chord font-semibold text-accent">
        <span className="text-text-3">|</span>
        {line.bars.map((bar, i) => (
          <span key={i} className="flex items-baseline gap-x-2">
            {bar.chords.map((c, j) => (
              <span key={j} className="whitespace-nowrap">
                {format(c)}
              </span>
            ))}
            <span className="text-text-3">|</span>
          </span>
        ))}
      </p>
    );
  }
  const hasChord = line.segments.some((s) => s.chord);
  if (!hasChord) {
    return <p className="whitespace-pre-wrap px-3 py-1.5 leading-[1.55]">{line.segments.map((s) => s.text).join('')}</p>;
  }
  return (
    <p className="flex flex-wrap px-3 py-1.5">
      {line.segments.map((seg, i) => (
        <span key={i} className="inline-flex flex-col whitespace-pre">
          <span className="h-[1.2em] pr-[0.35em] font-chord font-semibold leading-[1.2] text-accent">
            {seg.chord ? format(seg.chord) : ' '}
          </span>
          <span className="leading-[1.55]">{seg.text || ' '}</span>
        </span>
      ))}
    </p>
  );
}
