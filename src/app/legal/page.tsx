import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { PRICES } from '@/domain/plan';
import { SELLER } from '@/lib/seller';

export const metadata: Metadata = { title: '特定商取引法に基づく表記 | hikeru（ヒケル）' };

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`;

export default function Page() {
  const rows: [string, React.ReactNode][] = [
    ['販売事業者', SELLER.name],
    ['運営責任者', SELLER.representative],
    ['所在地', SELLER.address],
    ['電話番号', SELLER.phone],
    ['メールアドレス', SELLER.email],
    ['販売価格', `有料プラン 月額 ${yen(PRICES.month)}（税込）／年額 ${yen(PRICES.year)}（税込）`],
    ['商品代金以外の必要料金', 'インターネット接続にかかる通信料はお客様の負担となります'],
    ['支払方法', 'クレジットカード（決済は Stripe, Inc. が行います）'],
    [
      '支払時期',
      'お申し込みの時点で初回分をお支払いいただきます。以後、月額は毎月、年額は毎年、お申し込み日と同じ日に自動で更新し、その時点でお支払いいただきます',
    ],
    ['提供時期', '決済が完了した時点から、すぐにご利用いただけます'],
    [
      '解約',
      '設定画面の「プランを管理」から、いつでも解約できます。次回の更新日より前に解約すれば、次回以降の料金はかかりません。解約しても、お支払い済みの期間の終わりまではご利用いただけます',
    ],
    [
      '返品・返金',
      'デジタルサービスの性質上、お支払い後の返金（日割りを含む）はお受けしていません。ただし、当社の不具合でサービスを利用できなかった場合など、法令で必要な場合はこの限りではありません',
    ],
    ['動作環境', '最新版の Chrome・Safari・Edge・Firefox（PC・スマートフォン）'],
  ];
  return (
    <LegalPage title="特定商取引法に基づく表記">
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[10em_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mt-3 font-bold sm:mt-0 sm:font-normal sm:text-text-2">{k}</dt>
            <dd className="sm:mb-3">{v}</dd>
          </div>
        ))}
      </dl>
    </LegalPage>
  );
}
