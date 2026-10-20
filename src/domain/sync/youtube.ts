const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/**
 * YouTube の URL から動画 ID を取り出す（F-PRAC-01）。
 * watch?v=、youtu.be/、/embed/、/shorts/、/live/ に対応する。動画 ID そのものを渡してもよい。
 */
export function parseYouTubeId(input: string | undefined | null): string | null {
  const s = input?.trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (HOSTS.has(host)) {
    const v = url.searchParams.get('v');
    if (v) id = v;
    else {
      const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
      id = m?.[1] ?? null;
    }
  }
  return id && ID_RE.test(id) ? id : null;
}

/** URL の t= / start= に書かれた開始秒（あれば） */
export function parseStartSeconds(input: string | undefined | null): number | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}
