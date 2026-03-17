import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "OmniScribe",
  description: "Meeting intelligence dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 shrink-0">
            <Link href="/" className="text-lg font-bold text-white mb-8 tracking-tight">
              OmniScribe
            </Link>
            <div className="flex flex-col gap-1">
              <NavLink href="/" label="Dashboard" />
              <NavLink href="/sessions" label="All Sessions" />
              <NavLink href="/search" label="Search" />
            </div>
            <div className="mt-auto text-xs text-gray-600 pt-4 border-t border-gray-800">
              v0.1.0
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
    >
      {label}
    </Link>
  );
}
