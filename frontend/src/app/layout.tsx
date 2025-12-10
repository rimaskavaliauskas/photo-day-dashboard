import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Photo Day Dashboard',
  description: 'Your photography conditions at a glance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <span className="text-2xl">📷</span>
              <span>Photo Day Dashboard</span>
            </h1>
            <div className="text-sm text-zinc-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-800 mt-12 py-6 text-center text-sm text-zinc-600">
          <p>Photo Day Dashboard • Built with Next.js + Cloudflare</p>
        </footer>
      </body>
    </html>
  );
}
