// frontend/src/app/layout.js
'use client';

import './globals.css';
import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Add New Asset', href: '/assets/new' },
  { label: 'Settings', href: '/settings' },
];

function SidebarNav() {
  const pathname = usePathname() || '/';

  const isNavItemActive = (href) => {
    if (href === '/') {
      return pathname === '/' || (pathname.startsWith('/assets/') && pathname !== '/assets/new');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="flex-1 p-4 space-y-1.5">
      {navItems.map((item) => {
        const active = isNavItemActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? 'true' : 'false'}
            className={`block px-4 py-2.5 rounded-lg text-sm font-bold transition ${
              active
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-800 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarNavFallback() {
  return (
    <nav className="flex-1 p-4 space-y-1.5">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-active="false"
          className="block px-4 py-2.5 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-300"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function HeaderActions() {
  const pathname = usePathname() || '/';

  if (pathname === '/assets/new') return null;

  return (
    <Link
      href="/assets/new"
      className="text-xs bg-blue-600 text-white px-3.5 py-2 rounded-md font-bold hover:bg-blue-700 transition"
    >
      + New Asset
    </Link>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>IT Inventory Portal</title>
        <meta name="description" content="Enterprise Hardware & Software Asset Management" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                const savedPrefs = JSON.parse(localStorage.getItem('it_inventory_prefs') || '{}');
                const fontSizes = { small: 14, medium: 16, large: 18 };
                document.documentElement.style.fontSize =
                  (fontSizes[savedPrefs.fontSize] || 16) + 'px';
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-slate-100 text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100 transition-colors duration-200">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col shrink-0 border-r border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h1 className="text-xl font-extrabold tracking-tight text-blue-700 dark:text-blue-400">
                IT Inventory
              </h1>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                Asset Management System
              </p>
            </div>

            <Suspense fallback={<SidebarNavFallback />}>
              <SidebarNav />
            </Suspense>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-500">
              v2.0 Web Migration
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-100 dark:bg-slate-900">
            <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Enterprise Asset Portal
              </span>
              <div className="flex items-center space-x-4">
                <Suspense fallback={null}>
                  <HeaderActions />
                </Suspense>
              </div>
            </header>

            <main className="flex-1 p-8 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
