import type { Metadata } from 'next';
import { Clause, LegalPage } from '@/components/LegalPage';
import { SELLER } from '@/lib/seller';

export const metadata: Metadata = { title: 'プライバシーポリシー | hikeru（ヒケル）' };

export default function Page() {
  return (
    <LegalPage title="プライバシーポリシー">
      <p>
        {SELLER.name}（以下「当方」）は、「hikeru（ヒケル）」（以下「本サービス」）における利用者の個人情報を、個人情報の保護に関する法律その他の法令に従い、次のとおり取り扱います。
      </p>

      <Clause title="1. 取得する情報">
        <ul>
          <li>ログインに使うメールアドレス</li>
          <li>同期を使う場合、利用者が保存した譜面・設定・同期データ（動画の再生位置）</li>
          <li>有料プランを申し込んだ場合、購読の状態（プラン・更新日・解約予定）と決済サービス上の顧客 ID。クレジットカード番号は決済サービスが取得し、当方は保持しません</li>
          <li>アクセスの記録（IP アドレス、ブラウザの種類、日時など、サーバーが自動で記録する情報）</li>
        </ul>
      </Clause>

      <Clause title="2. 利用目的">
        <ul>
          <li>本サービスの提供（ログイン、譜面と設定の同期、有料プランの提供）</li>
          <li>料金の請求、問い合わせへの対応、重要なお知らせの連絡</li>
          <li>不正利用の防止、障害の調査、本サービスの改善</li>
        </ul>
      </Clause>

      <Clause title="3. 端末への保存">
        <p>
          本サービスは、オフラインでも使えるよう、譜面と設定を利用者の端末（ブラウザの IndexedDB・localStorage）に保存します。
          広告や行動追跡のための Cookie は使っていません。
        </p>
      </Clause>

      <Clause title="4. 外部のサービス（委託先・外国にある第三者）">
        <p>本サービスは、次の事業者のサービスを使っています。これらの事業者の一部は外国にあり、個人情報を外国で取り扱うことがあります。</p>
        <ul>
          <li>Supabase, Inc.（米国）: ログインとデータの保存。データは東京リージョンに保存します</li>
          <li>Vercel Inc.（米国）: 本サービスの配信</li>
          <li>Stripe, Inc.（米国）: 有料プランの決済</li>
          <li>Google LLC（米国）: YouTube の動画の埋め込み再生。動画を再生すると、YouTube の規約とプライバシーポリシーが適用されます</li>
        </ul>
        <p>米国には、日本と同等の個人情報保護の制度はありませんが、各事業者は自らのプライバシーポリシーに基づいて個人情報を保護する措置を講じています。</p>
      </Clause>

      <Clause title="5. 第三者への提供">
        <p>当方は、法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供しません。</p>
      </Clause>

      <Clause title="6. 開示・訂正・削除の請求">
        <p>
          利用者は、自分の個人情報の開示・訂正・利用停止・削除を求めることができます。下記の問い合わせ先までご連絡ください。本人であることを確認したうえで、遅滞なく対応します。
        </p>
      </Clause>

      <Clause title="7. 問い合わせ先">
        <p>
          {SELLER.name}
          <br />
          {SELLER.email}
        </p>
      </Clause>

      <Clause title="8. 改定">
        <p>このポリシーを変更する場合は、本サービス上で知らせます。</p>
      </Clause>

      <p className="text-text-2">{SELLER.effectiveDate} 制定</p>
    </LegalPage>
  );
}
