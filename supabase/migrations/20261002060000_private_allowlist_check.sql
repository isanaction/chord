-- 許可リストの照合関数を、API に公開されない private スキーマへ移す（Supabase のセキュリティ診断の指摘）。
-- ポリシーは関数を内部の ID で参照しているので、移動後もそのまま動く。
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_allowed_user() set schema private;
revoke all on function private.is_allowed_user() from public, anon;
grant execute on function private.is_allowed_user() to authenticated;
