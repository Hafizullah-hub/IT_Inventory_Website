// frontend/src/app/settings/page.jsx
'use client';

import { useSyncExternalStore } from 'react';

const THEME_CHANGE_EVENT = 'theme-change';

function subscribeToTheme(callback) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function getServerThemeSnapshot() {
  return false;
}

export default function SettingsPage() {
  const darkMode = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const toggleTheme = () => {
    const isDark = !getThemeSnapshot();
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
        Application Settings
      </h2>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            Dark Mode Appearance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Current mode: <strong>{darkMode ? 'Dark Mode' : 'Light Mode'}</strong>
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium rounded-lg hover:opacity-90 transition cursor-pointer"
        >
          {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </button>
      </div>
    </div>
  );
}
