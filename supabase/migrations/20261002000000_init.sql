-- 基本設計書 4章のテーブル。端末内（IndexedDB）と同じ構成にし、同期で行をそのまま送受信する。
-- 時刻は端末が付けたエポックミリ秒（bigint）。取得の目印には、サーバーが付ける server_updated_at を使う。

-- ───────── 利用を許可するメールアドレス（MVP は自分だけ。EX-10） ─────────
create table public.allowed_emails (
  email text primary key
);
alter table public.allowed_emails enable row level security;
-- 誰からも読み書きさせない（管理画面・SQL からのみ登録する）

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to authenticated;

-- ───────── 共通: サーバー更新時刻と「古い更新は無視」 ─────────
create or replace function public.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- 端末の更新時刻が古い更新は無視する（後から変えたほうを優先）
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

create type public.visibility as enum ('private', 'unlisted', 'public');
create type public.source_kind as enum ('manual', 'paste', 'web_import');

-- ───────── 楽曲 ─────────
create table public.songs (
  id uuid primary key,
  title text not null,
  title_reading text,
  artist text not null default '',
  artist_reading text,
  external_ids jsonb not null default '{}',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  server_updated_at timestamptz not null default now()
);

-- ───────── 譜面 ─────────
create table public.sheets (
  id uuid primary key,
  song_id uuid not null references public.songs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  visibility public.visibility not null default 'private',
  source_kind public.source_kind not null,
  source_url text,
  source_site text,
  imported_at bigint,
  original_key text,
  capo smallint not null default 0,
  bpm smallint,
  time_signature text not null default '4/4',
  reference_video_url text,
  current_revision_id uuid not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  -- EX-13: 外部取り込みの譜面は非公開以外にできない
  constraint web_import_must_be_private check (source_kind <> 'web_import' or visibility = 'private')
);

-- ───────── 譜面の版 ─────────
create table public.sheet_revisions (
  id uuid primary key,
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  revision_no integer not null,
  body jsonb not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  unique (sheet_id, revision_no)
);

-- ───────── 利用者 × 譜面の個人設定 ─────────
create table public.user_sheet_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  transpose smallint not null default 0,
  capo smallint,
  scroll_speed real not null default 24,
  instrument text not null default 'guitar',
  font_scale real not null default 1,
  simplify boolean not null default false,
  last_opened_at bigint,
  updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, sheet_id)
);

-- 取得用の索引（持ち主ごとに、更新順で読む）
create index songs_owner_sync on public.songs (created_by, server_updated_at);
create index sheets_owner_sync on public.sheets (owner_id, server_updated_at);
create index sheets_song on public.sheets (song_id);
create index sheet_revisions_owner_sync on public.sheet_revisions (created_by, server_updated_at);
create index sheet_revisions_sheet on public.sheet_revisions (sheet_id);
create index user_sheet_settings_owner_sync on public.user_sheet_settings (user_id, server_updated_at);
create index user_sheet_settings_sheet on public.user_sheet_settings (sheet_id);

create trigger songs_touch before insert or update on public.songs for each row execute function public.touch_row();
create trigger sheets_touch before insert or update on public.sheets for each row execute function public.touch_row();
create trigger sheet_revisions_touch before insert or update on public.sheet_revisions for each row execute function public.touch_row();
create trigger user_sheet_settings_touch before insert or update on public.user_sheet_settings for each row execute function public.touch_row();

-- ───────── 行単位のアクセス制御（4.3） ─────────
-- MVP: 許可リストにある本人だけが、自分の行を読み書きできる。削除は論理削除なので許可しない。
-- Phase 2 で sheets.visibility = 'public' を誰でも読めるポリシーを足す。
alter table public.songs enable row level security;
alter table public.sheets enable row level security;
alter table public.sheet_revisions enable row level security;
alter table public.user_sheet_settings enable row level security;

create policy songs_select on public.songs for select to authenticated
  using (created_by = (select auth.uid()) and (select public.is_allowed_user()));
create policy songs_insert on public.songs for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_allowed_user()));
create policy songs_update on public.songs for update to authenticated
  using (created_by = (select auth.uid()) and (select public.is_allowed_user()))
  with check (created_by = (select auth.uid()));

create policy sheets_select on public.sheets for select to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_allowed_user()));
create policy sheets_insert on public.sheets for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_allowed_user()));
create policy sheets_update on public.sheets for update to authenticated
  using (owner_id = (select auth.uid()) and (select public.is_allowed_user()))
  with check (owner_id = (select auth.uid()));

create policy sheet_revisions_select on public.sheet_revisions for select to authenticated
  using (created_by = (select auth.uid()) and (select public.is_allowed_user()));
create policy sheet_revisions_insert on public.sheet_revisions for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_allowed_user()));
create policy sheet_revisions_update on public.sheet_revisions for update to authenticated
  using (created_by = (select auth.uid()) and (select public.is_allowed_user()))
  with check (created_by = (select auth.uid()));

create policy user_sheet_settings_select on public.user_sheet_settings for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed_user()));
create policy user_sheet_settings_insert on public.user_sheet_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_allowed_user()));
create policy user_sheet_settings_update on public.user_sheet_settings for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed_user()))
  with check (user_id = (select auth.uid()));
