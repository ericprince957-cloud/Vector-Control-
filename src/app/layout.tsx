import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vector Control — Vector Codes',
  description: 'Internal CRM and Business Management System for Vector Codes'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
