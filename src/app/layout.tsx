import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Vector Control · Vector Codes', template: '%s · Vector Control' },
  description: 'Private business management platform for Vector Codes — CRM, deals, projects, finance and operations.',
  applicationName: 'Vector Control',
  icons: { icon: '/icon.png', apple: '/apple-icon.png' },
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
      <body>{children}</body>
    </html>
  );
}
