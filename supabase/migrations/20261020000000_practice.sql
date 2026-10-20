-- ステップ 1-3「練習できる」: 同期データと、練習用の個人設定（設計書 4.2・4.4、EX-07）。

-- ───────── 同期データ（動画の再生位置と譜面の行の対応） ─────────
create table public.sync_tracks (
  id uuid primary key,
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'youtube',
  video_id text not null,
  -- どの版の行 ID に対する時刻か
  revision_id uuid not null references public.sheet_revisions (id) on delete cascade,
  -- [{ "lineId": "l_x1", "t": 12340 }]（動画上のミリ秒）
  cues jsonb not null default '[]',
  offset_ms integer not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now()
);

create index sync_tracks_owner_sync on public.sync_tracks (owner_id, server_updated_at);
create index sync_tracks_sheet on public.sync_tracks (sheet_id);

create trigger sync_tracks_touch before insert or update on public.sync_tracks
  for each row execute function public.touch_row();

alter table public.sync_tracks enable row level security;

create policy sync_tracks_select on public.sync_tracks for select to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_allowed_user()));
create policy sync_tracks_insert on public.sync_tracks for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.is_allowed_user()));
create policy sync_tracks_update on public.sync_tracks for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.is_allowed_user()))
  with check (owner_id = (select auth.uid()));

-- ───────── 個人設定に練習の項目を足す ─────────
alter table public.user_sheet_settings
  add column loop jsonb,
  add column playback_rate real,
  add column sync_track_id uuid references public.sync_tracks (id) on delete set null;
