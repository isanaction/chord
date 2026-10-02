'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSheet, deleteSheet, getSheetDetail, metaOf, updateSheet, ValidationError } from '@/data/repository';
import { displayContext } from '@/domain/sheet/display';
import { parseSheetText } from '@/domain/sheet/parse';
import { preserveIds } from '@/domain/sheet/preserve';
import { toChordPro } from '@/domain/sheet/serialize';
import type { SheetBody, SheetMeta } from '@/domain/sheet/types';
import { IconAlert, IconDownload, IconLock, IconTrash } from './icons';
import { SheetView } from './SheetView';

export type ImportSource = { url: string; site: string; siteName: string; importedAt: number };

export type EditorInitial = {
  text: string;
  meta: SheetMeta;
  referenceVideoUrl?: string;
  source?: ImportSource;
};

type Form = { title: string; artist: string; key: string; capo: string; bpm: string; timeSignature: string; video: string };
type FieldName = keyof Form;

const EMPTY: Form = { title: '', artist: '', key: '', capo: '', bpm: '', timeSignature: '4/4', video: '' };

function formFromMeta(meta: SheetMeta, video?: string): Form {
  return {
    title: meta.title ?? '',
    artist: meta.artist ?? '',
    key: meta.key ?? '',
    capo: meta.capo ? String(meta.capo) : '',
    bpm: meta.bpm ? String(meta.bpm) : '',
    timeSignature: meta.timeSignature ?? '4/4',
    video: video ?? '',
  };
}

function toInt(s: string): number | undefined {
  const n = parseInt(s.normalize('NFKC'), 10);
  return Number.isFinite(n) ? n : undefined;
}

/** 譜面の新規作成・編集・取り込みの確認（PC では3列、スマホでは縦に並べる） */
export function EditorScreen({ sheetId, initial }: { sheetId?: string; initial?: EditorInitial }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => (initial ? formFromMeta(initial.meta, initial.referenceVideoUrl) : EMPTY));
  const [touched, setTouched] = useState<Set<FieldName>>(new Set());
  const [text, setText] = useState(initial?.text ?? '');
  const [loaded, setLoaded] = useState(!sheetId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const beforeBody = useRef<SheetBody | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // 編集: 保存済みの譜面を読み込む。本文には曲情報を含めず、フォームだけで管理する
  useEffect(() => {
    if (!sheetId) return;
    let alive = true;
    getSheetDetail(sheetId).then((d) => {
      if (!alive) return;
      if (!d) {
        setError('譜面が見つかりませんでした');
      } else {
        beforeBody.current = d.revision.body;
        setForm(formFromMeta(metaOf(d), d.sheet.referenceVideoUrl));
        setText(toChordPro({}, d.revision.body));
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [sheetId]);

  const parsed = useMemo(() => parseSheetText(text), [text]);

  // 本文から読み取れた曲情報は、まだ触っていない空欄にだけ使う
  const fromText: Partial<Form> = {
    title: parsed.meta.title,
    artist: parsed.meta.artist,
    key: parsed.meta.key,
    capo: parsed.meta.capo ? String(parsed.meta.capo) : undefined,
    bpm: parsed.meta.bpm ? String(parsed.meta.bpm) : undefined,
  };
  const value = (name: FieldName): string => (form[name] || touched.has(name) ? form[name] : (fromText[name] ?? ''));

  const meta: SheetMeta = {
    title: value('title').trim() || undefined,
    artist: value('artist').trim() || undefined,
    key: value('key').trim() || undefined,
    capo: toInt(value('capo')) ?? 0,
    bpm: toInt(value('bpm')),
    timeSignature: value('timeSignature').trim() || '4/4',
  };
  const preview = displayContext(parsed.body, { originalKey: meta.key, transpose: 0, capo: 0, simplify: false });

  const set = (name: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [name]: value }));
    setTouched((t) => new Set(t).add(name));
  };

  const jumpToLine = (lineNo: number) => {
    const el = textRef.current;
    if (!el) return;
    const lines = text.split('\n');
    const start = lines.slice(0, lineNo - 1).reduce((n, l) => n + l.length + 1, 0);
    el.focus();
    el.setSelectionRange(start, start + (lines[lineNo - 1]?.length ?? 0));
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const body = beforeBody.current ? preserveIds(beforeBody.current, parsed.body) : parsed.body;
      const input = { meta, body, referenceVideoUrl: value('video').trim() || undefined };
      let id = sheetId;
      if (id) {
        await updateSheet(id, input);
      } else {
        id = await createSheet({
          ...input,
          sourceKind: initial?.source ? 'web_import' : 'paste',
          sourceUrl: initial?.source?.url,
          sourceSite: initial?.source?.site,
        });
      }
      router.push(`/sheet?id=${id}`);
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : '保存できませんでした');
      setSaving(false);
    }
  };

  const exportChordPro = () => {
    const blob = new Blob([toChordPro(meta, parsed.body)], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(meta.title ?? 'sheet').replace(/[\\/:*?"<>|]/g, '_')}.cho`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async () => {
    if (!sheetId || !window.confirm('この譜面を削除しますか？')) return;
    await deleteSheet(sheetId);
    router.push('/');
  };

  if (!loaded) return <main className="h-dvh bg-bg" aria-busy="true" />;

  const warning = parsed.warnings[0];
  const cancelHref = sheetId ? `/sheet?id=${sheetId}` : '/';

  return (
    <main className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:overflow-hidden">
      <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-line px-4 lg:px-6">
        <Link href="/" className="hidden font-chord text-xl font-bold text-accent sm:block">
          Chord
        </Link>
        <nav aria-label="パンくず" className="flex min-w-0 gap-2 text-[13px] text-text-2">
          <Link href="/" className="shrink-0">
            ライブラリ
          </Link>
          <span>/</span>
          <span className="truncate text-text">{initial?.source ? '取り込んだ譜面の確認' : sheetId ? '譜面を編集' : '曲を追加'}</span>
        </nav>
        <span className="grow" />
        <Link href={cancelHref} className="flex h-10 shrink-0 items-center rounded-[10px] border border-line bg-surface px-4 text-sm">
          {initial?.source ? '破棄' : 'キャンセル'}
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 shrink-0 rounded-[10px] bg-accent-fill px-5 text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {initial?.source ? 'ライブラリに保存' : '保存'}
        </button>
      </header>

      {initial?.source && <ImportBanner source={initial.source} />}

      {error && (
        <p role="alert" className="mx-4 mt-4 rounded-xl border border-accent-border bg-accent-soft px-4 py-3 text-sm lg:mx-6">
          {error}
        </p>
      )}

      <div className="grid min-h-0 grow grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_400px] lg:px-6 lg:pb-6">
        <section aria-labelledby="meta-title" className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-[18px] lg:overflow-y-auto">
          <h2 id="meta-title" className="text-sm font-bold">
            曲情報
          </h2>
          <Field id="f-title" label="曲名（必須）" value={value('title')} onChange={set('title')} />
          <Field id="f-artist" label="アーティスト" value={value('artist')} onChange={set('artist')} />
          <div className="grid grid-cols-2 gap-2.5">
            <Field id="f-key" label="元キー" value={value('key')} onChange={set('key')} placeholder="例: A" />
            <Field id="f-capo" label="カポ" value={value('capo')} onChange={set('capo')} inputMode="numeric" placeholder="0" />
            <Field id="f-bpm" label="BPM" value={value('bpm')} onChange={set('bpm')} inputMode="numeric" />
            <Field id="f-ts" label="拍子" value={value('timeSignature')} onChange={set('timeSignature')} />
          </div>
          <Field
            id="f-video"
            label="参考動画（YouTube）"
            value={value('video')}
            onChange={set('video')}
            placeholder="https://www.youtube.com/watch?v=..."
            hint="あとで動画に合わせた練習に使います"
          />
          {sheetId && (
            <div className="mt-auto flex flex-col gap-2 pt-2">
              <button onClick={exportChordPro} className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line text-sm">
                ChordPro で書き出す
              </button>
              <button onClick={remove} className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-line text-sm text-text-2">
                <IconTrash size={16} />
                この譜面を削除
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="text-title" className="flex min-h-[420px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 id="text-title" className="text-sm font-bold">
              譜面テキスト
            </h2>
            <div className="flex items-center gap-2 text-xs text-text-2">
              <span>読み取り形式：{parsed.format === 'chordpro' ? 'ChordPro' : 'コード行＋歌詞行'}</span>
              {parsed.format === 'chords-over-words' && text.trim() && (
                <button onClick={() => setText(toChordPro({}, parsed.body))} className="h-8 rounded-lg border border-line-strong bg-surface-2 px-3 text-text">
                  ChordPro に変換
                </button>
              )}
            </div>
          </div>
          <label htmlFor="sheet-text" className="sr-only">
            譜面テキスト
          </label>
          <textarea
            id="sheet-text"
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={'コード譜のテキストを貼り付けてください。\n\n例（コード行＋歌詞行）\nC       G\nまだ眠る街の\n\n例（ChordPro）\n[C]まだ眠る[G]街の'}
            className="min-h-0 grow resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-6 outline-none placeholder:text-text-3"
          />
          {warning && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-line bg-accent-soft px-4 py-3">
              <span className="text-accent">
                <IconAlert size={18} />
              </span>
              <span className="grow text-[13px]">
                {warning.line} 行目：{warning.message}
                {parsed.warnings.length > 1 && <span className="text-text-2">（ほか {parsed.warnings.length - 1} 件）</span>}
              </span>
              <button onClick={() => jumpToLine(warning.line)} className="h-[34px] rounded-lg border border-line-strong bg-surface-2 px-3.5 text-[13px]">
                該当行へ
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby="preview-title" className="flex min-h-[300px] flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <h2 id="preview-title" className="text-sm font-bold">
              プレビュー
            </h2>
            <span className="text-xs text-text-2">
              {[meta.key && `キー ${meta.key}`, meta.capo ? `カポ ${meta.capo}` : 'カポなし'].filter(Boolean).join(' · ')}
            </span>
          </div>
          <div className="min-h-0 grow overflow-y-auto px-2 py-3.5">
            {parsed.body.sections.length > 0 ? (
              <SheetView body={parsed.body} format={preview.format} compact />
            ) : (
              <p className="px-3 text-sm text-text-3">テキストを入力すると、ここに表示されます</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ImportBanner({ source }: { source: ImportSource }) {
  const when = new Date(source.importedAt).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <div className="mx-4 mt-4 flex flex-wrap items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3 lg:mx-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">
        <IconDownload size={18} />
      </span>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="text-sm font-bold">{source.siteName} から取り込みました。内容を確認して保存してください</span>
        <span className="truncate font-mono text-xs text-text-2">
          {source.url} · {when}
        </span>
      </div>
      <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-text-2">
        <IconLock size={14} />
        非公開で保存（取り込んだ譜面は公開できません）
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs text-text-2">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className="h-[38px] rounded-lg border border-line-strong bg-bg px-2.5 text-sm outline-none placeholder:text-text-3 focus:border-accent"
      />
      {hint && <span className="text-[11px] text-text-3">{hint}</span>}
    </div>
  );
}
