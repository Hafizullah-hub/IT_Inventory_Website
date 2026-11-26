// frontend/src/app/settings/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AssetService } from '../../services/api';

const DEFAULT_TEMPLATE = {
  company: 'TechCorp Malaysia Sdn Bhd',
  ad: 'Joined - corp.company.my',
  osName: 'Windows 11 Pro',
  osBit: '64-bit',
  officeVersion: 'Microsoft 365 Apps for Enterprise',
  antivirusName: 'CrowdStrike Falcon Sensor',
  warranty: '3 Years Onsite Support',
};

const DEFAULT_PREFS = {
  defaultShowAnalytics: true,
  fontSize: 'medium',
};

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small', pixels: 14 },
  { value: 'medium', label: 'Medium', pixels: 16 },
  { value: 'large', label: 'Large', pixels: 18 },
];

const applyFontSize = (fontSize) => {
  const option = FONT_SIZE_OPTIONS.find((item) => item.value === fontSize);
  document.documentElement.style.fontSize = `${option?.pixels ?? 16}px`;
};

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saveMessage, setSaveMessage] = useState('');

  // System Diagnostics State
  const [diag, setDiag] = useState({
    checking: true,
    online: false,
    latencyMs: 0,
    totalRecords: 0,
    lastChecked: '',
    error: '',
  });

  // Backup states
  const [backingUpJson, setBackingUpJson] = useState(false);
  const [backingUpCsv, setBackingUpCsv] = useState(false);

  const checkSystemHealth = useCallback(async () => {
    setDiag((prev) => ({ ...prev, checking: true, error: '' }));
    const start = performance.now();
    try {
      const res = await AssetService.getAssets({ page: 1, limit: 1 });
      const latency = Math.round(performance.now() - start);
      const total = res.pagination?.total ?? res.stats?.totalAssets ?? 0;
      setDiag({
        checking: false,
        online: true,
        latencyMs: latency,
        totalRecords: total,
        lastChecked: new Date().toLocaleTimeString(),
        error: '',
      });
    } catch (err) {
      setDiag({
        checking: false,
        online: false,
        latencyMs: 0,
        totalRecords: 0,
        lastChecked: new Date().toLocaleTimeString(),
        error: err.message || 'Unable to reach backend server on Port 5000',
      });
    }
  }, []);

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('theme') === 'dark';
    setDarkMode(isDark);

    try {
      const savedTemplate = localStorage.getItem('it_inventory_defaults');
      if (savedTemplate) {
        setTemplate({ ...DEFAULT_TEMPLATE, ...JSON.parse(savedTemplate) });
      }
      const savedPrefs = localStorage.getItem('it_inventory_prefs');
      if (savedPrefs) {
        const nextPrefs = { ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) };
        setPrefs(nextPrefs);
        applyFontSize(nextPrefs.fontSize);
      }
    } catch (e) {}

    checkSystemHealth();
  }, [checkSystemHealth]);

  const changeFontSize = (fontSize) => {
    const nextPrefs = { ...prefs, fontSize };
    setPrefs(nextPrefs);
    applyFontSize(fontSize);
    localStorage.setItem('it_inventory_prefs', JSON.stringify(nextPrefs));
  };

  const toggleTheme = (enableDark) => {
    setDarkMode(enableDark);
    if (enableDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    localStorage.setItem('it_inventory_defaults', JSON.stringify(template));
    localStorage.setItem('it_inventory_prefs', JSON.stringify(prefs));
    setSaveMessage('Settings and default templates saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleResetDefaults = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setPrefs(DEFAULT_PREFS);
    localStorage.setItem('it_inventory_defaults', JSON.stringify(DEFAULT_TEMPLATE));
    localStorage.setItem('it_inventory_prefs', JSON.stringify(DEFAULT_PREFS));
    applyFontSize(DEFAULT_PREFS.fontSize);
    localStorage.removeItem('it_inventory_table_limit');
    setSaveMessage('All settings restored to factory defaults.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  // Download Full Raw JSON Backup
  const handleDownloadJsonBackup = async () => {
    try {
      setBackingUpJson(true);
      const res = await AssetService.getAssets({ page: 1, limit: 2000 });
      const data = res.data || [];
      const payload = {
        exportedAt: new Date().toISOString(),
        totalRecords: data.length,
        assets: data,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `IT_Inventory_Full_Backup_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setBackingUpJson(false);
    }
  };

  // Download Master CSV Backup
  const handleDownloadMasterCsv = async () => {
    try {
      setBackingUpCsv(true);
      const res = await AssetService.getAssets({ page: 1, limit: 2000 });
      const rows = res.data || [];
      if (!rows.length) {
        alert('No records found to export.');
        return;
      }

      const headers = [
        'Document ID', 'Asset No', 'Serial Number', 'Asset Type', 'Manufacturer', 'Model',
        'Computer Name', 'Active Directory Status', 'Storage Box Location', 'Assigned User',
        'Department', 'Company', 'Physical Location', 'Last Used Date', 'Processor', 'RAM',
        'Storage Drive', 'Additional Hardware', 'OS Name', 'OS Architecture', 'OS Product Key',
        'Microsoft Office Version', 'Office License Key', 'Antivirus Name', 'Antivirus Product Key',
        'Antivirus Start Date', 'Antivirus Expiry Date', 'Antivirus Last Update',
        'Other Installed Software', 'Supplier / Vendor', 'CAPEX Number', 'Purchase Order No',
        'Purchase Order Date', 'Invoice Number', 'Purchase Amount (RM)', 'Warranty Status',
        'Primary Remark', 'Secondary Remark', 'Physical File Sequence',
      ];

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      };

      const csvLines = [
        headers.map(escapeCsv).join(','),
        ...rows.map((a) =>
          [
            a.documentId, a.core_details?.asset_no, a.core_details?.serial, a.core_details?.type,
            a.core_details?.manufacturer, a.core_details?.model, a.core_details?.comp_name,
            a.core_details?.ad, a.core_details?.box_locate, a.assignment?.user, a.assignment?.dept,
            a.assignment?.company, a.assignment?.location, a.assignment?.last_use,
            a.hardware?.processor, a.hardware?.ram, a.hardware?.hardisk,
            a.hardware?.additional_hardware, a.software?.os?.name, a.software?.os?.bit,
            a.software?.os?.product_key, a.software?.office?.version,
            a.software?.office?.licence_key, a.software?.antivirus?.name,
            a.software?.antivirus?.product_key, a.software?.antivirus?.start_date,
            a.software?.antivirus?.expiry_date, a.software?.antivirus?.last_update,
            a.software?.other_app, a.procurement?.supplier, a.procurement?.capex_no,
            a.procurement?.po_no, a.procurement?.po_date, a.procurement?.invoice_no,
            a.procurement?.amount ?? 0, a.procurement?.warranty, a.metadata?.remark1,
            a.metadata?.remark2, a.metadata?.file_seq,
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ];

      const blob = new Blob(['\uFEFF' + csvLines.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `IT_Inventory_Master_${rows.length}_Assets_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('CSV export failed: ' + err.message);
    } finally {
      setBackingUpCsv(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none';
  const labelClass =
    'block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            System Settings & Preferences
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Configure portal appearance, default new-asset templates, and database backups.
          </p>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-sm font-bold text-emerald-800 dark:text-emerald-300">
          {saveMessage}
        </div>
      )}

      {/* 1. Live System & Database Diagnostics */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Backend API & Database Diagnostics
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              Live connection health for your Node.js Express server and MongoDB Atlas cluster.
            </p>
          </div>
          <button
            type="button"
            onClick={checkSystemHealth}
            disabled={diag.checking}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 transition cursor-pointer"
          >
            {diag.checking ? 'Testing Connection...' : 'Test Connection'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              Backend Server (Port 5000)
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  diag.online ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                {diag.checking ? 'Checking...' : diag.online ? 'Online & Healthy' : 'Offline'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {diag.online ? `Response Latency: ${diag.latencyMs} ms` : diag.error}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              MongoDB Atlas Storage
            </p>
            <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1.5">
              {diag.online ? `${diag.totalRecords} Registered Assets` : 'Unavailable'}
            </p>
            <p className="text-xs font-medium text-slate-500 mt-1">
              {diag.lastChecked ? `Last verified at ${diag.lastChecked}` : 'Waiting for check'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              AI Natural Language Engine
            </p>
            <p className="text-sm font-extrabold text-indigo-700 dark:text-indigo-400 mt-1.5">
              Local NLP + Gemini Failover
            </p>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Instant local parsing & caching enabled
            </p>
          </div>
        </div>
      </div>

      {/* 2. Appearance & Default Templates */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 p-6 space-y-6"
      >
        <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Appearance & Portal Behavior
          </h3>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Customize your color theme and default analytics panel visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Theme Mode */}
          <div>
            <label className={labelClass}>Color Theme</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleTheme(false)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  !darkMode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
              >
                Light Mode
              </button>
              <button
                type="button"
                onClick={() => toggleTheme(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  darkMode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
              >
                Dark Mode
              </button>
            </div>
          </div>

          {/* Interface Font Size */}
          <div>
            <label className={labelClass}>Interface Font Size</label>
            <div className="flex gap-2" role="group" aria-label="Interface font size">
              {FONT_SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeFontSize(option.value)}
                  aria-pressed={prefs.fontSize === option.value}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    prefs.fontSize === option.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Default Visual Analytics Panel State */}
          <div>
            <label className={labelClass}>Visual Analytics Panel on Startup</label>
            <select
              value={prefs.defaultShowAnalytics ? 'true' : 'false'}
              onChange={(e) =>
                setPrefs({ ...prefs, defaultShowAnalytics: e.target.value === 'true' })
              }
              className={inputClass}
            >
              <option value="true">Expanded by Default</option>
              <option value="false">Hidden by Default</option>
            </select>
          </div>
        </div>

        {/* 3. Default Values for "+ New Asset" Registration */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <div className="mb-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Default Values for &ldquo;+ New Asset&rdquo; Form
            </h3>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
              These standard company and software fields will automatically pre-fill whenever you register a new asset.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Default Company Name</label>
              <input
                type="text"
                value={template.company}
                onChange={(e) => setTemplate({ ...template, company: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Default Active Directory Status</label>
              <input
                type="text"
                value={template.ad}
                onChange={(e) => setTemplate({ ...template, ad: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Default Operating System</label>
              <input
                type="text"
                value={template.osName}
                onChange={(e) => setTemplate({ ...template, osName: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Default OS Architecture</label>
              <input
                type="text"
                value={template.osBit}
                onChange={(e) => setTemplate({ ...template, osBit: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Default Microsoft Office Version</label>
              <input
                type="text"
                value={template.officeVersion}
                onChange={(e) => setTemplate({ ...template, officeVersion: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Default Antivirus Software</label>
              <input
                type="text"
                value={template.antivirusName}
                onChange={(e) => setTemplate({ ...template, antivirusName: e.target.value })}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Default Warranty Terms</label>
              <input
                type="text"
                value={template.warranty}
                onChange={(e) => setTemplate({ ...template, warranty: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50 transition cursor-pointer"
          >
            Reset to Factory Defaults
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
          >
            Save All Preferences & Defaults
          </button>
        </div>
      </form>

      {/* 4. Data Management & Full Database Backup */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 p-6">
        <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Database Backup & Master Export
          </h3>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Download a complete snapshot of all MongoDB asset documents for safekeeping or external auditing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadJsonBackup}
            disabled={backingUpJson}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {backingUpJson ? 'Generating JSON Backup...' : 'Download Full JSON Backup (.json)'}
          </button>

          <button
            type="button"
            onClick={handleDownloadMasterCsv}
            disabled={backingUpCsv}
            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {backingUpCsv ? 'Generating Master CSV...' : 'Download Master Excel Inventory (.csv)'}
          </button>
        </div>
      </div>
    </div>
  );
}
