import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/globals.css';

// Load Cairo font with Arabic subset
const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'لوحة مراقب - نظام POS',
  description: 'لوحة تحكم شاملة لمراقبة المبيعات والعمليات',
  icons: {
    icon: '/favicon.ico',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={cairo.variable}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#001F5C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className="font-cairo text-text-primary">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
