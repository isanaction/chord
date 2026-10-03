import type { Metadata, Viewport } from 'next';
import { Barlow_Semi_Condensed, IBM_Plex_Sans_JP, JetBrains_Mono } from 'next/font/google';
import { AppRuntime } from '@/components/AppRuntime';
import { THEME_INIT_SCRIPT } from '@/lib/theme-script';
import './globals.css';

const plex = IBM_Plex_Sans_JP({
  variable: '--font-plex',
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  preload: false,
});

const barlow = Barlow_Semi_Condensed({
  variable: '--font-barlow',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  weight: ['400', '500'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'hikeru（ヒケル）',
  description: '自分用のコード譜・練習アプリ',
  // MVP は非公開（NF-10）。検索エンジンに載せない
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'hikeru', statusBarStyle: 'black-translucent' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#111317',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className={`${plex.variable} ${barlow.variable} ${jetbrains.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <AppRuntime />
      </body>
    </html>
  );
}
