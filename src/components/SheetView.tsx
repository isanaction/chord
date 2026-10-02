import type { ChordToken } from '@/domain/chord/chord';
import type { Line, SheetBody } from '@/domain/sheet/types';

type Props = {
  body: SheetBody;
  format: (token: ChordToken) => string;
  /** 文字サイズの倍率 */
  scale?: number;
  compact?: boolean;
};

/** 歌詞とコードを揃えて表示する（F-VIEW-01）。 */
export function SheetView({ body, format, scale = 1, compact = false }: Props) {
  const base = (compact ? 14 : 17) * scale;
  return (
    <div className="flex flex-col" style={{ gap: base * 0.9, fontSize: base }}>
      {body.sections.map((section) => (
        <section key={section.id} aria-label={section.label || undefined} className="flex flex-col gap-0.5">
          {section.label && (
            <h3 className="px-3 pb-1 text-[0.72em] font-bold tracking-wider text-text-2">{section.label}</h3>
          )}
          {section.lines.map((line) => (
            <SheetLine key={line.id} line={line} format={format} />
          ))}
        </section>
      ))}
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
