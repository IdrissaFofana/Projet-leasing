import type { Metadata } from 'next';
import { Source_Sans_3, IBM_Plex_Mono, Libre_Baskerville } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { LocaleProvider } from '@/lib/locale-context';
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider';
import './globals.css';

const body = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const display = Source_Sans_3({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

const serif = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'ESAY — Suivi Leasing',
  description: 'Console ESAY parc copieurs, stock, relevés et facturation',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${body.variable} ${display.variable} ${serif.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <LocaleProvider>
          <FeedbackProvider>
            <AuthProvider>{children}</AuthProvider>
          </FeedbackProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
