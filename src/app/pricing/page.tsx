import type { Metadata } from 'next';
import { PricingScreen } from '@/components/PricingScreen';

export const metadata: Metadata = { title: '料金プラン | hikeru（ヒケル）' };

export default function Page() {
  return <PricingScreen />;
}
