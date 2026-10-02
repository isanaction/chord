'use client';

import { Suspense } from 'react';
import { EditorScreen } from '@/components/EditorScreen';
import { IdParam } from '@/components/IdParam';

export default function Page() {
  return (
    <Suspense>
      <IdParam>{(id) => <EditorScreen key={id} sheetId={id} />}</IdParam>
    </Suspense>
  );
}
