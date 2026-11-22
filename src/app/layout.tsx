import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterServiceWorker } from '@/components/pwa';

export const metadata: Metadata = {
  title: { default: 'Vector Control · Vector Codes', template: '%s · Vector Control' },
  description: 'Private business management platform for Vector Codes — CRM, deals, projects, finance and operations.',
  applicationName: 'Vector Control',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: 'Vector', statusBarStyle: 'black-translucent' },
  authors: [{ name: 'Vector Codes' }],
  // Private internal system: never index.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
