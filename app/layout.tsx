import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BackgroundActivity } from './BackgroundActivity';
import { DesktopThemeProvider } from './DesktopTheme';
import { DesktopEffectsProvider } from './desktop/Effects';

export const metadata: Metadata = {
  title: 'Book Club 98',
  description: 'Windows 98 스타일 독서 기록장',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BookClub98',
  },
};

export const viewport: Viewport = {
  themeColor: '#008080',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="desktop-surface overflow-hidden select-none bg-[#008080] text-black">
        <BackgroundActivity /><DesktopThemeProvider><DesktopEffectsProvider>{children}</DesktopEffectsProvider></DesktopThemeProvider>
      </body>
    </html>
  );
}