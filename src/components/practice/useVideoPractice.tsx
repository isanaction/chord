'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoopRange, SyncTrack, UserSheetSettings } from '@/data/db';
import { createSyncTrack, findSyncTrack, updateSyncTrack } from '@/data/repository';
import type { SheetBody } from '@/domain/sheet/types';
import {
  currentLineId,
  formatTime,
  loopSeekTarget,
  nextLineId,
  nudgeCue,
  recordCue,
  removeCue,
  resolveLoop,
  timedLines,
  untimedCount,
  usableCues,
} from '@/domain/sync/cues';
import type { PracticeMarks } from '../SheetView';
import { type PlayerControl, useYouTubePlayer } from './useYouTubePlayer';

type Patch = Partial<Omit<UserSheetSettings, 'userId' | 'sheetId'>>;

export type Mode = 'play' | 'record';

type Args = {
  sheetId: string;
  revisionId: string;
  body: SheetBody;
  videoId: string | null;
  settings: UserSheetSettings;
  update: (patch: Patch) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  /** 動画プレーヤーを置く要素 */
  videoRef: RefObject<HTMLDivElement | null>;
};

export type VideoPractice = {
  player: PlayerControl;
  mode: Mode;
  setMode: (m: Mode) => void;
  marks: PracticeMarks;
  /** 表示用の再生位置（ミリ秒）。画面の更新を抑えるため 0.2 秒ごと */
  nowMs: number;
  loop: { label: string; range: { a: number; b: number } | null } | null;
  loopDraftA: number | null;
  /** A 点 → B 点 → 解除 の順に進める */
  stepLoop: () => void;
  clearLoop: () => void;
  rate: number;
  changeRate: (dir: -1 | 1) => void;
  togglePlay: () => void;
  skip: (ms: number) => void;
  /** 記録モード: 次の行の時刻を今の再生位置で記録する */
  recordNow: () => void;
  selectedLineId: string | null;
  selectedTime: string | null;
  nudgeSelected: (deltaMs: number) => void;
  removeSelected: () => void;
  playFromSelected: () => void;
  offsetMs: number;
  nudgeOffset: (deltaMs: number) => void;
  untimed: number;
  hasCues: boolean;
};

/** 動画に合わせた練習（F-PRAC-01〜04）。プレーヤー・同期データ・ループ・記録をまとめて扱う */
export function useVideoPractice({ sheetId, revisionId, body, videoId, settings, update, scrollRef, videoRef }: Args): VideoPractice {
  const rate = settings.playbackRate ?? 1;
  const player = useYouTubePlayer(videoRef, videoId, rate);

  const stored = useLiveQuery(() => (videoId ? findSyncTrack(sheetId, videoId) : null), [sheetId, videoId]);
  // 作った直後は useLiveQuery の結果がまだ古いので、手元の値を優先する
  const [local, setLocal] = useState<SyncTrack | null>(null);
  const mine = local?.sheetId === sheetId && local.videoId === videoId ? local : null;
  const track = mine && (!stored || mine.updatedAt >= stored.updatedAt) ? mine : (stored ?? null);
  const cues = useMemo(() => usableCues(body, track?.cues ?? []), [body, track]);
  const offsetMs = track?.offsetMs ?? 0;

  const [mode, setModeState] = useState<Mode>('play');
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [loopDraftA, setLoopDraftA] = useState<number | null>(null);

  const range = useMemo(
    () => resolveLoop(settings.loop as LoopRange | undefined, body, cues, offsetMs, player.durationMs),
    [settings.loop, body, cues, offsetMs, player.durationMs],
  );

  // 毎フレームの処理から最新の値を読むための参照
  const live = useRef({ cues, offsetMs, range, mode, playing: player.playing });
  useEffect(() => {
    live.current = { cues, offsetMs, range, mode, playing: player.playing };
  });

  const { ready, currentMs, seek } = player;
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    let lastDisplay = 0;
    let lastActive: string | null = null;
    const tick = (now: number) => {
      const t = currentMs();
      const s = live.current;
      const line = currentLineId(s.cues, t, s.offsetMs);
      if (line !== lastActive) {
        lastActive = line;
        setActiveLineId(line);
      }
      if (s.playing && s.mode === 'play') {
        const target = loopSeekTarget(t, s.range);
        if (target !== null) seek(target);
      }
      if (now - lastDisplay > 200) {
        lastDisplay = now;
        setNowMs(t);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, currentMs, seek]);

  // 再生中は、演奏中の行が画面の上から 1/3 あたりに来るようにスクロールする（設計書 7.1）
  const followId = mode === 'record' ? pendingLineId : player.playing ? activeLineId : null;
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !followId) return;
    const el = box.querySelector<HTMLElement>(`[data-line-id="${CSS.escape(followId)}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: 'smooth' });
  }, [followId, scrollRef]);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      setSelectedLineId(null);
      if (m === 'record') {
        // まだ時刻のない最初の行から記録する
        const timed = new Set((track?.cues ?? []).map((c) => c.lineId));
        const first = timedLines(body).find((l) => !timed.has(l.lineId));
        setPendingLineId(first?.lineId ?? nextLineId(body, null));
      } else setPendingLineId(null);
    },
    [body, track],
  );

  /*
   * 同期データの変更は1つずつ順に、直前に保存した内容に対して行う。
   * 「記録」を続けて押したときに、保存が終わる前の古い内容から計算して時刻が消えたり、
   * 最初の記録で同期データが2つできたりしないようにする。
   */
  const latest = useRef<SyncTrack | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    const l = latest.current;
    const sameTarget = l?.sheetId === sheetId && l.videoId === videoId;
    if (!sameTarget) latest.current = track;
    else if (track && track.id === l!.id && track.updatedAt > l!.updatedAt) latest.current = track;
  }, [track, sheetId, videoId]);

  const mutateTrack = useCallback(
    (change: (base: { cues: SyncTrack['cues']; offsetMs: number }) => { cues?: SyncTrack['cues']; offsetMs?: number }) => {
      queue.current = queue.current
        .then(async () => {
          let base = latest.current?.sheetId === sheetId && latest.current.videoId === videoId ? latest.current : null;
          if (!base) {
            if (!videoId) return;
            base = await createSyncTrack({ sheetId, videoId, revisionId });
            if (settings.syncTrackId !== base.id) update({ syncTrackId: base.id });
          }
          const saved = await updateSyncTrack(base.id, { ...change(base), revisionId });
          if (saved) {
            latest.current = saved;
            setLocal(saved);
          }
        })
        .catch((e) => console.error('同期データを保存できませんでした', e));
    },
    [videoId, sheetId, revisionId, settings.syncTrackId, update],
  );

  const recordNow = useCallback(() => {
    const lineId = pendingLineId ?? nextLineId(body, null);
    if (!lineId) return;
    // 押した瞬間の位置を記録する。補正を引いて保存し、補正込みで今の位置に来るようにする
    const t = currentMs();
    mutateTrack((base) => ({ cues: recordCue(base.cues, lineId, t - base.offsetMs) }));
    setSelectedLineId(lineId);
    setPendingLineId(nextLineId(body, lineId));
  }, [pendingLineId, body, mutateTrack, currentMs]);

  const cueOf = (lineId: string | null) => (lineId ? (track?.cues ?? []).find((c) => c.lineId === lineId) : undefined);

  const onLineClick = useCallback(
    (lineId: string) => {
      if (mode === 'record') {
        setPendingLineId(lineId);
        setSelectedLineId(lineId);
        return;
      }
      // 再生モードでは、時刻のある行を押すとそこから再生する
      const cue = (track?.cues ?? []).find((c) => c.lineId === lineId);
      if (cue) seek(cue.t + offsetMs);
    },
    [mode, track, seek, offsetMs],
  );

  const onSectionClick = useCallback(
    (sectionId: string) => {
      const current = settings.loop;
      const same = current && 'sectionId' in current && current.sectionId === sectionId;
      setLoopDraftA(null);
      update({ loop: same ? undefined : { sectionId } });
    },
    [settings.loop, update],
  );

  const lineTimes = useMemo(() => {
    if (mode !== 'record') return undefined;
    return new Map((track?.cues ?? []).map((c) => [c.lineId, formatTime(c.t + offsetMs)]));
  }, [mode, track, offsetMs]);

  const loopSectionId = settings.loop && 'sectionId' in settings.loop ? settings.loop.sectionId : null;
  const loop = useMemo(() => {
    if (!settings.loop) return null;
    if ('sectionId' in settings.loop) {
      const label = body.sections.find((s) => s.id === loopSectionId)?.label || 'セクション';
      return { label: range ? label : `${label}（時刻が未記録）`, range };
    }
    return { label: `${formatTime(settings.loop.a)}–${formatTime(settings.loop.b)}`, range };
  }, [settings.loop, body, loopSectionId, range]);

  const stepLoop = useCallback(() => {
    const t = currentMs();
    if (settings.loop) {
      update({ loop: undefined });
      setLoopDraftA(null);
    } else if (loopDraftA === null) {
      setLoopDraftA(t);
    } else if (t > loopDraftA + 500) {
      update({ loop: { a: loopDraftA, b: t } });
      setLoopDraftA(null);
    }
  }, [currentMs, settings.loop, loopDraftA, update]);

  const clearLoop = useCallback(() => {
    update({ loop: undefined });
    setLoopDraftA(null);
  }, [update]);

  const changeRate = useCallback(
    (dir: -1 | 1) => {
      const list = [...player.rates].sort((a, b) => a - b);
      const i = list.findIndex((r) => r >= rate - 1e-6);
      const next = list[Math.min(list.length - 1, Math.max(0, (i < 0 ? list.length - 1 : i) + dir))];
      if (next === undefined || next === rate) return;
      player.setRate(next);
      update({ playbackRate: next });
    },
    [player, rate, update],
  );

  const togglePlay = useCallback(() => (player.playing ? player.pause() : player.play()), [player]);
  const skip = useCallback((ms: number) => seek(currentMs() + ms), [seek, currentMs]);

  const selected = cueOf(selectedLineId);
  const nudgeSelected = useCallback(
    (deltaMs: number) => {
      if (!selectedLineId || !track) return;
      mutateTrack((base) => ({ cues: nudgeCue(base.cues, selectedLineId, deltaMs) }));
    },
    [selectedLineId, track, mutateTrack],
  );
  const removeSelected = useCallback(() => {
    if (!selectedLineId || !track) return;
    mutateTrack((base) => ({ cues: removeCue(base.cues, selectedLineId) }));
  }, [selectedLineId, track, mutateTrack]);
  const playFromSelected = useCallback(() => {
    const cue = (track?.cues ?? []).find((c) => c.lineId === selectedLineId);
    if (!cue) return;
    seek(Math.max(0, cue.t + offsetMs - 1500));
    player.play();
  }, [track, selectedLineId, seek, offsetMs, player]);
  const nudgeOffset = useCallback(
    (deltaMs: number) => {
      if (!track) return;
      mutateTrack((base) => ({ offsetMs: base.offsetMs + deltaMs }));
    },
    [track, mutateTrack],
  );

  return {
    player,
    mode,
    setMode,
    marks: {
      activeLineId: mode === 'play' ? activeLineId : null,
      pendingLineId: mode === 'record' ? pendingLineId : null,
      lineTimes,
      loopSectionId,
      onLineClick,
      onSectionClick: mode === 'play' ? onSectionClick : undefined,
    },
    nowMs,
    loop,
    loopDraftA,
    stepLoop,
    clearLoop,
    rate,
    changeRate,
    togglePlay,
    skip,
    recordNow,
    selectedLineId,
    selectedTime: selected ? formatTime(selected.t + offsetMs) : null,
    nudgeSelected,
    removeSelected,
    playFromSelected,
    offsetMs,
    nudgeOffset,
    untimed: untimedCount(body, track?.cues ?? []),
    hasCues: cues.length > 0,
  };
}
