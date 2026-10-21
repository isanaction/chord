'use client';

import Link from 'next/link';
import { useState } from 'react';
import { openBillingPortal, startCheckout, usePlan } from '@/data/billing';
import { type BillingInterval, FREE_PRACTICE_SHEETS_PER_DAY, PRICES } from '@/domain/plan';
import { IconBack } from './icons';

const yen = (n: number) => `${n.toLocaleString('ja-JP')}円`;

const FEATURES: [string, string, string][] = [
  ['譜面の保存・編集・取り込み', '無制限', '無制限'],
  ['移調・カポ・自動スクロール・コード音・メトロノーム', '○', '○'],
  ['動画に合わせた譜面の追従（同期再生）', '○', '○'],
  ['区間ループ・速度変更', `1日 ${FREE_PRACTICE_SHEETS_PER_DAY} 曲まで`, '無制限'],
  ['PC・スマホの同期、オフライン表示', '○', '○'],
];

/** 料金プランと申し込み（要求定義 F-DATA-06）。申し込みボタンの直前に、契約の主な内容を表示する（特定商取引法 第12条の6） */
export function PricingScreen() {
  const plan = usePlan();
  const [interval, setBillingInterval] = useState<BillingInterval>('year');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const price = PRICES[interval];
  const period = interval === 'month' ? '1か月' : '1年';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 bg-bg px-5 pt-[max(16px,env(safe-area-inset-top))] pb-12">
      <header className="flex items-center gap-1">
        <Link href="/settings" aria-label="設定に戻る" className="-ml-3 flex h-11 w-11 items-center justify-center">
          <IconBack />
        </Link>
        <h1 className="text-xl font-bold">料金プラン</h1>
      </header>

      <p className="text-sm leading-7 text-text-2">
        譜面を見る・弾く機能は無料で使えます。有料プランでは、区間ループと速度変更を回数を気にせず使えます。今後追加する有料プランの機能も、追加料金なしで使えます。
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-text-2">
            <th className="py-2 font-normal">機能</th>
            <th className="w-24 py-2 text-center font-normal">無料</th>
            <th className="w-24 py-2 text-center font-bold text-accent">有料</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map(([name, free, premium]) => (
            <tr key={name} className="border-b border-line">
              <td className="py-2.5 pr-2 leading-6">{name}</td>
              <td className="py-2.5 text-center text-text-2">{free}</td>
              <td className="py-2.5 text-center">{premium}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="申し込み" className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-5">
        {!plan.billingEnabled ? (
          <p className="text-sm leading-7">有料プランは準備中です。いまはすべての機能を無料で使えます。</p>
        ) : plan.plan === 'premium' ? (
          <>
            <p className="text-sm leading-7">有料プランをご利用中です。支払い方法の変更・解約は「プランを管理」から行えます。</p>
            <button
              onClick={() => void go(openBillingPortal)}
              disabled={busy}
              className="h-11 self-start rounded-[10px] border border-line-strong bg-surface-2 px-5 text-sm disabled:opacity-60"
            >
              プランを管理
            </button>
          </>
        ) : !plan.signedIn ? (
          <p className="text-sm leading-7">
            申し込むには、先に
            <Link href="/settings" className="text-accent underline">
              設定
            </Link>
            からログインしてください。
          </p>
        ) : (
          <>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">支払いの間隔</legend>
              {(['month', 'year'] as const).map((i) => (
                <label
                  key={i}
                  className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 ${interval === i ? 'border-accent bg-accent-soft' : 'border-line-strong'}`}
                >
                  <input type="radio" name="interval" value={i} checked={interval === i} onChange={() => setBillingInterval(i)} className="sr-only" />
                  <span className="text-xs text-text-2">{i === 'month' ? '月額' : '年額'}</span>
                  <span className="font-chord text-lg font-bold">{yen(PRICES[i])}</span>
                  <span className="text-xs text-text-2">{i === 'month' ? '税込・毎月' : `税込・毎年（月あたり ${yen(Math.round(PRICES.year / 12))}）`}</span>
                </label>
              ))}
            </fieldset>

            <dl aria-label="申し込み内容" className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm leading-6">
              <dt className="text-text-2">料金</dt>
              <dd>
                {yen(price)}（税込）／{period}
              </dd>
              <dt className="text-text-2">契約期間</dt>
              <dd>{period}ごとに自動で更新します。解約するまで続きます</dd>
              <dt className="text-text-2">支払い</dt>
              <dd>クレジットカード。申し込み時と、以後の更新日ごとに支払います</dd>
              <dt className="text-text-2">利用開始</dt>
              <dd>決済の完了後すぐ</dd>
              <dt className="text-text-2">解約</dt>
              <dd>設定の「プランを管理」からいつでも。支払い済みの期間の終わりまで使えます。日割りの返金はありません</dd>
            </dl>

            <label className="flex items-start gap-2 text-sm leading-6">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1.5 h-4 w-4 accent-accent" />
              <span>
                <Link href="/terms" className="text-accent underline">
                  利用規約
                </Link>
                と
                <Link href="/privacy" className="text-accent underline">
                  プライバシーポリシー
                </Link>
                に同意します
              </span>
            </label>

            <button
              onClick={() => void go(() => startCheckout(interval))}
              disabled={!agreed || busy}
              className="h-12 rounded-[10px] bg-accent-fill px-5 text-sm font-bold text-on-accent disabled:opacity-60"
            >
              {busy ? '決済画面を開いています…' : `${yen(price)}／${period}で申し込む`}
            </button>
            <p className="text-xs leading-5 text-text-2">決済は Stripe の画面で行います。カード番号は hikeru には送られません。</p>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}
      </section>

      <nav aria-label="規約類" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-2">
        <Link href="/terms" className="underline">
          利用規約
        </Link>
        <Link href="/privacy" className="underline">
          プライバシーポリシー
        </Link>
        <Link href="/legal" className="underline">
          特定商取引法に基づく表記
        </Link>
      </nav>
    </main>
  );
}
