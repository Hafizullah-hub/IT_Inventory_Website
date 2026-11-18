// frontend/src/app/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AssetService } from '../services/api';

export default function DashboardPage() {
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalValue: 0,
    workstations: 0,
    assigned: 0,
  });
  const [loading, setLoading] = useState(true);

  // Standard Filter States
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');

  // AI Search States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiFiltered, setIsAiFiltered] = useState(false);
  const [aiError, setAiError] = useState('');

  // Serial copy state
  const [copiedId, setCopiedId] = useState(null);

  const samplePrompts = [
    'Laptops over RM 4500',
    'Assets using CrowdStrike antivirus',
    'IT department assets with 32GB or 256GB RAM',
    'All Dell or HP assets',
  ];

  // Fallback helper if backend hasn't reloaded yet
  const calculateFallbackStats = (items, totalCount) => {
    const totalValue = items.reduce((sum, a) => sum + (Number(a.procurement?.amount) || 0), 0);
    const workstations = items.filter((a) =>
      ['Laptop', 'Desktop'].includes(a.core_details?.type)
    ).length;
    const assigned = items.filter(
      (a) => a.assignment?.user && a.assignment.user !== 'Unassigned'
    ).length;
    return {
      totalAssets: totalCount ?? items.length,
      totalValue,
      workstations,
      assigned,
    };
  };

  const fetchInventory = useCallback(async (page = 1) => {
    setLoading(true);
    setAiError('');
    try {
      const response = await AssetService.getAssets({ page, search, dept, type });
      const items = response.data || [];
      const pag = response.pagination || { page: 1, pages: 1, total: items.length };
      setAssets(items);
      setPagination(pag);
      setStats(response.stats || calculateFallbackStats(items, pag.total));
    } catch (error) {
      setAiError(error.message);
    } finally {
      setLoading(false);
    }
  }, [search, dept, type]);

  useEffect(() => {
    const timer = setTimeout(() => fetchInventory(1), 300);
    return () => clearTimeout(timer);
  }, [fetchInventory]);

  const handleAiSearch = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const queryText = customPrompt !== null ? customPrompt : aiPrompt;
    if (!queryText.trim()) return;

    if (customPrompt !== null) setAiPrompt(customPrompt);

    setAiLoading(true);
    setAiError('');
    try {
      const res = await AssetService.aiSearch(queryText);
      const items = res.data || [];
      const pag = res.pagination || { page: 1, pages: 1, total: items.length };
      setAssets(items);
      setPagination(pag);
      setStats(res.stats || calculateFallbackStats(items, pag.total));
      setIsAiFiltered(true);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiSearch = () => {
    setAiPrompt('');
    setIsAiFiltered(false);
    setAiError('');
    fetchInventory(1);
  };

  const handleCopySerial = async (documentId, serial) => {
    if (!serial) return;
    try {
      await navigator.clipboard.writeText(serial);
      setCopiedId(documentId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      setAiError('Failed to copy serial number');
    }
  };

  const formatCurrency = (val) =>
    `RM ${Number(val || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Hardware & Software Assets
          </h2>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
            Showing {assets.length} of {pagination.total} registered assets
          </p>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Assets
          </p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            {stats.totalAssets}
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
            Matching current view
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Asset Value
          </p>
          <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1.5">
            {formatCurrency(stats.totalValue)}
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
            {stats.workstations}
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
            {stats.assigned} <span className="text-sm font-bold text-slate-500">/ {stats.totalAssets}</span>
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
            Actively deployed to staff
          </p>
        </div>
      </div>

      {/* Natural Language AI Search Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border-2 border-indigo-200 dark:border-indigo-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            AI Natural Language Inventory Search
          </span>
          {isAiFiltered && (
            <button
              type="button"
              onClick={clearAiSearch}
              className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
            >
              Reset AI Filter
            </button>
          )}
        </div>

        <form onSubmit={(e) => handleAiSearch(e)} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Ask in plain English, e.g. 'Show all laptops in Finance or IT over RM 4,500'..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={aiLoading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition cursor-pointer shrink-0"
          >
            {aiLoading ? 'Analyzing Query...' : 'Ask AI'}
          </button>
        </form>

        {/* Quick Sample Prompts */}
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

      {/* Standard Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <input
            type="text"
            placeholder="Quick keyword search (Asset No, Serial, User, Computer Name)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
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
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm text-slate-900 dark:text-slate-100">
              {loading || aiLoading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center font-medium text-slate-700 dark:text-slate-300">
                    {aiLoading ? 'Running AI query on inventory...' : 'Loading assets...'}
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center font-medium text-slate-700 dark:text-slate-300">
                    No matching assets found.
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
                          {asset.documentId}
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
