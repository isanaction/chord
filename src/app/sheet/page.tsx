'use client';

import { Suspense } from 'react';
import { IdParam } from '@/components/IdParam';
import { SheetScreen } from '@/components/SheetScreen';

export default function Page() {
  return (
    <Suspense>
      <IdParam>{(id) => <SheetScreen key={id} id={id} />}</IdParam>
    </Suspense>
  );
}
