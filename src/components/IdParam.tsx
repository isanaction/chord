'use client';

import { useSearchParams } from 'next/navigation';

/** URL の ?id= を読んで子に渡す（端末内のデータを表示するページは静的に作り、id はクエリで受け取る） */
export function IdParam({ children }: { children: (id: string) => React.ReactNode }) {
  const id = useSearchParams().get('id');
  if (!id) return <main className="p-6">譜面が指定されていません。</main>;
  return children(id);
}
