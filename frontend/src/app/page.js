// frontend/src/app/page.js
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { AssetService } from '../services/api';

export default function DashboardPage() {
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Overall Stats (Always locked to full inventory)
  const [overallStats, setOverallStats] = useState({
    totalAssets: 0,
    totalValue: 0,
    workstations: 0,
    assigned: 0,
    analytics: { byDept: [], byBrand: [], byType: [] },
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Rows Per Page Control Above the List
  const [limit, setLimit] = useState(10);

  // Analytics, Help Guide & CSV Export UI states
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Cache & Refs
  const overallCacheRef = useRef(null);
  const skipNextEffectRef = useRef(false);
  const keywordInputRef = useRef(null);

  // Standard Filter States
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');

  // AI Search States
  const [aiPrompt, setAiPrompt] = useState('');
  const [activeAiQuery, setActiveAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiFiltered, setIsAiFiltered] = useState(false);
  const [aiError, setAiError] = useState('');
  const [inventoryError, setInventoryError] = useState('');
  const [actionError, setActionError] = useState('');

  // Serial copy state
  const [copiedId, setCopiedId] = useState(null);

  const samplePrompts = [
    'Laptops over RM 4500',
    'Assets using CrowdStrike antivirus',
    'IT department assets with 32GB or 256GB RAM',
    'All Dell or HP assets',
  ];

  // Load saved preferences from Settings on mount
  useEffect(() => {
    try {
      const savedLimit = localStorage.getItem('it_inventory_table_limit');
      if (savedLimit) setLimit(Number(savedLimit));

      const savedPrefs = localStorage.getItem('it_inventory_prefs');
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        if (typeof parsed.defaultShowAnalytics === 'boolean') {
          setShowAnalytics(parsed.defaultShowAnalytics);
        }
      }
    } catch (e) {}
  }, []);

  // Heuristic #7: Keyboard Accelerator ('/' focuses search, 'Escape' clears active input)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        keywordInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasActiveFilter = Boolean(isAiFiltered || search.trim() || dept || type);

  const calculateFallbackStats = (items, totalCount) => {
    const totalValue = items.reduce((sum, a) => sum + (Number(a.procurement?.amount) || 0), 0);
    const workstations = items.filter((a) =>
      ['Laptop', 'Desktop'].includes(a.core_details?.type)
    ).length;
    const assigned = items.filter(
      (a) => a.assignment?.user && a.assignment.user !== 'Unassigned'
    ).length;

    const deptMap = {};
    const brandMap = {};
    const typeMap = {};

    items.forEach((a) => {
      const amt = Number(a.procurement?.amount) || 0;
      const d = a.assignment?.dept || 'Unassigned';
      const b = a.core_details?.manufacturer || 'Other';
      const t = a.core_details?.type || 'Other';

      deptMap[d] = { name: d, count: (deptMap[d]?.count || 0) + 1, value: (deptMap[d]?.value || 0) + amt };
      brandMap[b] = { name: b, count: (brandMap[b]?.count || 0) + 1, value: (brandMap[b]?.value || 0) + amt };
      typeMap[t] = { name: t, count: (typeMap[t]?.count || 0) + 1, value: (typeMap[t]?.value || 0) + amt };
    });

    return {
      totalAssets: totalCount ?? items.length,
      totalValue,
      workstations,
      assigned,
      analytics: {
        byDept: Object.values(deptMap).sort((x, y) => y.value - x.value),
        byBrand: Object.values(brandMap).sort((x, y) => y.count - x.count),
        byType: Object.values(typeMap).sort((x, y) => y.count - x.count),
      },
    };
  };

  const fetchInventory = useCallback(
    async (page = 1, customFilters = null) => {
      const activeSearch = customFilters ? customFilters.search : search;
      const activeDept = customFilters ? customFilters.dept : dept;
      const activeType = customFilters ? customFilters.type : type;
      const activeLimit = customFilters?.limit || limit;
      const isUnfiltered = !activeSearch.trim() && !activeDept && !activeType;

      setIsRefreshing(true);
      setInventoryError('');
      setIsAiFiltered(false);
      setActiveAiQuery('');

      try {
        const response = await AssetService.getAssets({
          page,
          limit: activeLimit,
          search: activeSearch,
          dept: activeDept,
          type: activeType,
        });
        const items = response.data || [];
        const pag = response.pagination || { page: 1, pages: 1, total: items.length };

        setAssets(items);
        setPagination(pag);

        if (isUnfiltered) {
          const computedStats = response.stats || calculateFallbackStats(items, pag.total);
          setOverallStats(computedStats);

          if (page === 1) {
            overallCacheRef.current = {
              assets: items,
              pagination: pag,
              stats: computedStats,
              limit: activeLimit,
            };
          }
        }
      } catch (error) {
        setInventoryError(error.message);
      } finally {
        setInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [search, dept, type, limit]
  );

  useEffect(() => {
    if (skipNextEffectRef.current) {
      skipNextEffectRef.current = false;
      return;
    }
    const timer = setTimeout(() => fetchInventory(1), 250);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  const handleLimitChange = (newLimit) => {
    const parsed = Number(newLimit);
    setLimit(parsed);
    localStorage.setItem('it_inventory_table_limit', String(parsed));
  };

  const handleAiSearch = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const queryText = customPrompt !== null ? customPrompt : aiPrompt;
    if (!queryText.trim()) return;

    if (customPrompt !== null) setAiPrompt(customPrompt);

    setAiLoading(true);
    setAiError('');
    setInventoryError('');
    try {
      const res = await AssetService.aiSearch(queryText);
      const items = res.data || [];
      const pag = res.pagination || { page: 1, pages: 1, total: items.length };
      setAssets(items);
      setPagination(pag);
      setIsAiFiltered(true);
      setActiveAiQuery(queryText.trim());
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAllFilters = () => {
    setInventoryError('');
    if (search || dept || type) {
      skipNextEffectRef.current = true;
    }

    setAiPrompt('');
    setActiveAiQuery('');
    setIsAiFiltered(false);
    setAiError('');
    setSearch('');
    setDept('');
    setType('');

    if (overallCacheRef.current && overallCacheRef.current.limit === limit) {
      setAssets(overallCacheRef.current.assets);
      setPagination(overallCacheRef.current.pagination);
    } else {
      fetchInventory(1, { search: '', dept: '', type: '', limit });
    }
  };

  // Export Matching Assets (All 38 Fields) to CSV / Excel
  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      setActionError('');
      let rowsToExport = assets;

      if (!isAiFiltered && pagination.total > assets.length) {
        const fullRes = await AssetService.getAssets({
          page: 1,
          limit: 1000,
          search,
          dept,
          type,
        });
        rowsToExport = fullRes.data || assets;
      }

      if (!rowsToExport.length) {
        alert('No assets to export.');
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
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const csvLines = [
        headers.map(escapeCsv).join(','),
        ...rowsToExport.map((a) =>
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
      link.setAttribute(
        'download',
        hasActiveFilter
          ? `IT_Inventory_Filtered_${rowsToExport.length}_Assets_${dateStr}.csv`
          : `IT_Inventory_Full_${rowsToExport.length}_Assets_${dateStr}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError('Failed to export CSV: ' + err.message);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleCopySerial = async (documentId, serial) => {
    if (!serial) return;
    try {
      setActionError('');
      await navigator.clipboard.writeText(serial);
      setCopiedId(documentId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setActionError('Failed to copy serial number. Check clipboard permissions and try again.');
    }
  };

  const formatCurrency = (val) =>
    `RM ${Number(val || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const byDept = overallStats.analytics?.byDept || [];
  const byBrand = overallStats.analytics?.byBrand || [];
  const byType = overallStats.analytics?.byType || [];

  return (
    <div className="space-y-6">
      {/* Header with Analytics Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Hardware & Software Assets
          </h2>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
            Enterprise IT Asset Overview & Search
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAnalytics((prev) => !prev)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
              showAnalytics
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
            }`}
          >
            {showAnalytics ? 'Hide Visual Analytics' : 'Show Visual Analytics'}
          </button>
        </div>
      </div>

      {/* Overall Inventory Summary Stats (Always Locked to Overall Inventory) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Overall Inventory Summary — Showing all registered assets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Assets
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
              {overallStats.totalAssets}
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
              All registered inventory
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Asset Value
            </p>
            <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1.5">
              {formatCurrency(overallStats.totalValue)}
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
              Cumulative procurement cost
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Laptops & Desktops
            </p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
              {overallStats.workstations}
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
              End-user workstations
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assigned Assets
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1.5">
              {overallStats.assigned}{' '}
              <span className="text-sm font-bold text-slate-500">/ {overallStats.totalAssets}</span>
            </p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
              Actively deployed to staff
            </p>
          </div>
        </div>
      </div>

      {/* Overall Visual Analytics Breakdown Section (Heuristic #7: Clickable bars act as quick filter accelerators) */}
      {showAnalytics && overallStats.totalAssets > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Spend by Department
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Click bar to filter
              </span>
            </div>
            <div className="space-y-3">
              {byDept.map((item) => {
                const pct =
                  overallStats.totalValue > 0
                    ? Math.round((item.value / overallStats.totalValue) * 100)
                    : 0;
                const isSelected = dept === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setDept(isSelected ? '' : item.name)}
                    title={`Click to filter by ${item.name} department`}
                    className={`w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-lg transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-slate-700/70 ring-1 ring-blue-300 dark:ring-blue-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>
                        {item.name}{' '}
                        <span className="text-slate-500 font-semibold">({item.count} units)</span>
                      </span>
                      <span className="text-blue-700 dark:text-blue-400">
                        {formatCurrency(item.value)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Assets by Brand
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Click bar to filter
              </span>
            </div>
            <div className="space-y-3">
              {byBrand.map((item) => {
                const pct =
                  overallStats.totalAssets > 0
                    ? Math.round((item.count / overallStats.totalAssets) * 100)
                    : 0;
                const isSelected = search.toLowerCase() === item.name.toLowerCase();
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSearch(isSelected ? '' : item.name)}
                    title={`Click to filter by ${item.name}`}
                    className={`w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-lg transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-slate-700/70 ring-1 ring-indigo-300 dark:ring-indigo-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>{item.name}</span>
                      <span>
                        {item.count} units ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Device Categories
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Click bar to filter
              </span>
            </div>
            <div className="space-y-3">
              {byType.map((item) => {
                const pct =
                  overallStats.totalAssets > 0
                    ? Math.round((item.count / overallStats.totalAssets) * 100)
                    : 0;
                const isSelected = type === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setType(isSelected ? '' : item.name)}
                    title={`Click to filter by ${item.name}`}
                    className={`w-full text-left space-y-1 p-1.5 -mx-1.5 rounded-lg transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-slate-700/70 ring-1 ring-emerald-300 dark:ring-emerald-700'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                      <span>
                        {item.name} <span className="text-slate-500">({pct}%)</span>
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {item.count} units • {formatCurrency(item.value)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showAnalytics && overallStats.totalAssets === 0 && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Visual Analytics
          </h3>
          <p
            className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400"
            role={inventoryError ? 'alert' : 'status'}
          >
            {initialLoading
              ? 'Loading inventory analytics...'
              : inventoryError
                ? `Analytics are unavailable because inventory data could not be loaded: ${inventoryError} Check that BACKEND_URL is configured for the deployed frontend.`
                : 'No inventory assets are available yet. Add assets to see the analytics breakdown.'}
          </p>
        </div>
      )}

      {/* Natural Language AI Search Card (With Heuristic #3 Clear Button & Heuristic #10 Help Guide) */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border-2 border-indigo-200 dark:border-indigo-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              AI Natural Language Inventory Search
            </span>
            <button
              type="button"
              onClick={() => setShowAiHelp((prev) => !prev)}
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
            >
              {showAiHelp ? 'Hide Search Guide' : 'Search Guide'}
            </button>
          </div>
          {isAiFiltered && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            >
              Reset AI Filter
            </button>
          )}
        </div>

        {/* Heuristic #10: Contextual Help & Documentation Drawer */}
        {showAiHelp && (
          <div className="mb-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            <p className="font-extrabold text-slate-900 dark:text-white">
              What can you ask the AI Search?
            </p>
            <p>
              You can combine multiple criteria in plain English across <strong>Brand</strong> (HP, Dell, Lenovo, HPE),{' '}
              <strong>Model</strong> (ProBook, ThinkPad, OptiPlex), <strong>Specs</strong> (16GB, 32GB RAM, i5, i7, 1TB),{' '}
              <strong>Cost</strong> (over RM 5000, under RM 4000), <strong>Department</strong> (IT, Finance, HR, Operations),{' '}
              <strong>Software/AV</strong> (CrowdStrike, Kaspersky, Sophos, SAP, Docker), or <strong>Supplier</strong> (VSTECS, Ingram Micro).
            </p>
          </div>
        )}

        <form onSubmit={(e) => handleAiSearch(e)} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask in plain English, e.g. 'Show all laptops in Finance or IT over RM 4,500'..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAiPrompt('');
              }}
              className="w-full pl-4 pr-9 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            {aiPrompt && (
              <button
                type="button"
                onClick={() => {
                  setAiPrompt('');
                  if (isAiFiltered) clearAllFilters();
                }}
                title="Clear AI search input"
                aria-label="Clear AI search input"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={aiLoading || !aiPrompt.trim()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition cursor-pointer shrink-0"
          >
            {aiLoading ? 'Analyzing Query...' : 'Ask AI'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Try:</span>
          {samplePrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleAiSearch(null, item)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 transition cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>

        {aiError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
            {aiError}
          </div>
        )}
      </div>

      {/* Standard Search & Filter Bar (With Heuristic #3 Clear Input & Heuristic #7 '/' Shortcut Badge) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <input
            ref={keywordInputRef}
            type="text"
            placeholder="Quick keyword search (Press '/' to focus)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearch('');
            }}
            className="w-full pl-4 pr-14 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Clear keyword search"
              aria-label="Clear keyword search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm px-1 cursor-pointer"
            >
              ✕
            </button>
          ) : (
            <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-500 rounded">
              /
            </kbd>
          )}
        </div>
        <div>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Departments</option>
            <option value="IT">IT</option>
            <option value="Finance">Finance</option>
            <option value="HR">Human Resources</option>
            <option value="Operations">Operations</option>
          </select>
        </div>
        <div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Asset Types</option>
            <option value="Laptop">Laptop</option>
            <option value="Desktop">Desktop</option>
            <option value="Server">Server</option>
            <option value="Monitor">Monitor</option>
          </select>
        </div>
      </div>

      {/* Table Toolbar Directly Above the List (Heuristic #1 Visibility of Active Filters & #3 User Control) */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white mr-1">
            Showing {assets.length} of {pagination.total} matching assets
          </span>

          {/* Removable Active Filter Chips */}
          {isAiFiltered && activeAiQuery && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
              AI: &ldquo;{activeAiQuery}&rdquo;
              <button
                type="button"
                onClick={clearAllFilters}
                className="hover:text-red-600 font-extrabold cursor-pointer"
                title="Remove AI filter"
              >
                ✕
              </button>
            </span>
          )}

          {search.trim() && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              Keyword: &ldquo;{search.trim()}&rdquo;
              <button
                type="button"
                onClick={() => setSearch('')}
                className="hover:text-red-600 font-extrabold cursor-pointer"
                title="Remove keyword filter"
              >
                ✕
              </button>
            </span>
          )}

          {dept && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
              Dept: {dept}
              <button
                type="button"
                onClick={() => setDept('')}
                className="hover:text-red-600 font-extrabold cursor-pointer"
                title="Remove department filter"
              >
                ✕
              </button>
            </span>
          )}

          {type && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Type: {type}
              <button
                type="button"
                onClick={() => setType('')}
                className="hover:text-red-600 font-extrabold cursor-pointer"
                title="Remove type filter"
              >
                ✕
              </button>
            </span>
          )}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer ml-1"
            >
              Clear All
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isAiFiltered && (
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Rows:
              </label>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv || pagination.total === 0}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {exportingCsv
              ? 'Preparing Excel CSV...'
              : `Export to CSV / Excel (${pagination.total})`}
          </button>
        </div>
        {actionError && (
          <p role="alert" className="basis-full text-sm font-medium text-red-700 dark:text-red-300">
            {actionError}
          </p>
        )}
      </div>

      {isRefreshing && !initialLoading && (
        <p role="status" className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Updating inventory results...
        </p>
      )}

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-200/70 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600 text-xs uppercase text-slate-900 dark:text-slate-100 font-bold tracking-wider">
                <th className="py-3.5 px-4">Asset No</th>
                <th className="py-3.5 px-4">Type & Model</th>
                <th className="py-3.5 px-4">Serial No</th>
                <th className="py-3.5 px-4">Assigned User</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">OS / Hardware</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-slate-200 dark:divide-slate-700 text-sm text-slate-900 dark:text-slate-100 transition-opacity duration-150 ${
                isRefreshing || aiLoading ? 'opacity-60' : 'opacity-100'
              }`}
            >
              {initialLoading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center font-medium text-slate-700 dark:text-slate-300">
                    Loading assets...
                  </td>
                </tr>
              ) : inventoryError ? (
                <tr>
                  <td colSpan="7" className="py-12 px-4 text-center">
                    <div className="mx-auto max-w-md space-y-3">
                      <p className="text-base font-extrabold text-red-800 dark:text-red-300">
                        Inventory could not be loaded
                      </p>
                      <p role="alert" className="text-sm text-slate-700 dark:text-slate-300">
                        {inventoryError}
                      </p>
                      <button
                        type="button"
                        onClick={() => fetchInventory(pagination.page || 1)}
                        className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                /* Heuristic #9: Help Users Recognize, Diagnose, and Recover from Empty/Failed Searches */
                <tr>
                  <td colSpan="7" className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">
                        No matching IT assets found
                      </p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        We couldn&apos;t find any records matching your current search criteria. Try broadening your terms or reset the active filters below.
                      </p>
                      {hasActiveFilter && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-xs"
                        >
                          Reset All Filters & Show All Assets
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                assets.map((asset) => {
                  const serial = asset.core_details?.serial;
                  const isCopied = copiedId === asset.documentId;

                  return (
                    <tr
                      key={asset.documentId}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition"
                    >
                      <td className="py-3.5 px-4 font-bold text-blue-700 dark:text-blue-400">
                        <Link href={`/assets/${encodeURIComponent(asset.documentId)}`} className="hover:underline">
                          {asset.core_details?.asset_no || 'No asset number'}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {asset.core_details?.manufacturer} {asset.core_details?.model}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {asset.core_details?.type}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 dark:text-slate-200">
                        {serial ? (
                          <div className="flex items-center gap-1.5">
                            <span>{serial}</span>
                            <button
                              type="button"
                              onClick={() => handleCopySerial(asset.documentId, serial)}
                              title={isCopied ? 'Copied!' : 'Copy Serial Number'}
                              aria-label="Copy Serial Number"
                              className={`p-1.5 rounded-md border transition cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700'
                                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600'
                              }`}
                            >
                              {isCopied ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3.5 w-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-3.5 w-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {asset.assignment?.user || 'Unassigned'}
                        </div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {asset.assignment?.location}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-slate-700 text-blue-900 dark:text-slate-100">
                          {asset.assignment?.dept || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {asset.software?.os?.name || 'No OS'}
                        </div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {asset.hardware?.processor || '-'} / {asset.hardware?.ram || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-3">
                        <Link
                          href={`/assets/${encodeURIComponent(asset.documentId)}`}
                          className="text-blue-700 dark:text-blue-400 hover:underline text-xs font-bold"
                        >
                          View
                        </Link>
                        <Link
                          href={`/assets/${encodeURIComponent(asset.documentId)}/edit`}
                          className="text-slate-800 dark:text-slate-200 hover:underline text-xs font-bold"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 flex items-center justify-between text-xs text-slate-900 dark:text-slate-200 font-bold">
          <span>
            Page {pagination.page} of {pagination.pages || 1}
          </span>
          <div className="space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchInventory(pagination.page - 1)}
              className="px-3 py-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold disabled:opacity-40 hover:bg-slate-200 transition"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => fetchInventory(pagination.page + 1)}
              className="px-3 py-1.5 rounded-md border border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold disabled:opacity-40 hover:bg-slate-200 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
