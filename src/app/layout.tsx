import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import '../styles/tailwind.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0f1e',
};

export const metadata: Metadata = {
  title: 'SkyPulse — Real-Time Weather Intelligence',
  description: 'SkyPulse delivers real-time weather, 7-day forecasts, and detailed meteorological data for any location worldwide.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} dark`}>
      <body className={dmSans.className}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(17, 24, 39, 0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              backdropFilter: 'blur(20px)',
            },
          }}
        />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fskypul6771back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></body>
    </html>
  );
}