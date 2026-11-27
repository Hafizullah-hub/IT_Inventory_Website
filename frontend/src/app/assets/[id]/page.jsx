// frontend/src/app/assets/[id]/page.jsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AssetService } from '../../../services/api';

// 1. Default export wraps the content in <Suspense> for Next.js 16+
export default function AssetDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading asset details...</div>}>
      <AssetDetailContent />
    </Suspense>
  );
}

// 2. Inner component safely uses useParams()
function AssetDetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const [asset, setAsset] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    AssetService.getAssetById(decodeURIComponent(id))
      .then((res) => setAsset(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    const assetLabel =
      asset.core_details?.asset_no ||
      [asset.core_details?.manufacturer, asset.core_details?.model].filter(Boolean).join(' ') ||
      'this asset';
    if (!confirm(`Are you sure you want to delete ${assetLabel}?`)) return;
    try {
      await AssetService.deleteAsset(asset.documentId);
      router.push('/');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">Loading asset details...</div>;
  if (!asset) return <div className="p-8 text-red-500">Asset not found.</div>;

  const tabs = [
    { id: 'overview', label: 'Core & Assignment' },
    { id: 'hardware', label: 'Hardware Specs' },
    { id: 'software', label: 'Software & Licenses' },
    { id: 'procurement', label: 'Procurement & Metadata' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex min-w-0 items-center gap-4">
          {asset.imageId ? (
            <Image
              src={AssetService.getAssetImageUrl(asset.documentId)}
              alt={`${asset.core_details?.manufacturer || 'Asset'} ${asset.core_details?.model || ''}`}
              width={112}
              height={96}
              unoptimized
              className="h-24 w-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900"
            />
          ) : (
            <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
              No photo
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-mono text-xs font-semibold rounded">
                {asset.core_details?.asset_no || 'No asset number'}
              </span>
              <h1 className="text-2xl font-bold">
                {asset.core_details?.manufacturer} {asset.core_details?.model}
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Assigned to <strong className="text-slate-700 dark:text-slate-200">{asset.assignment?.user}</strong> ({asset.assignment?.dept})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/assets/${encodeURIComponent(asset.documentId)}/edit`}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-sm font-medium rounded-lg transition"
          >
            Edit Asset
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex space-x-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Cards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard
            title="Core Asset Details"
            items={[
              { label: 'Asset Number', value: asset.core_details?.asset_no },
              { label: 'Serial Number', value: asset.core_details?.serial },
              { label: 'Device Type', value: asset.core_details?.type },
              { label: 'Manufacturer', value: asset.core_details?.manufacturer },
              { label: 'Model', value: asset.core_details?.model },
              { label: 'Computer Name', value: asset.core_details?.comp_name },
              { label: 'Active Directory (AD)', value: asset.core_details?.ad },
              { label: 'Box Location', value: asset.core_details?.box_locate },
            ]}
          />
          <DetailCard
            title="User Assignment"
            items={[
              { label: 'Assigned User', value: asset.assignment?.user },
              { label: 'Department', value: asset.assignment?.dept },
              { label: 'Company', value: asset.assignment?.company },
              { label: 'Physical Location', value: asset.assignment?.location },
              { label: 'Last Use Date', value: asset.assignment?.last_use },
            ]}
          />
        </div>
      )}

      {activeTab === 'hardware' && (
        <DetailCard
          title="Hardware Configuration"
          items={[
            { label: 'Processor (CPU)', value: asset.hardware?.processor },
            { label: 'Memory (RAM)', value: asset.hardware?.ram },
            { label: 'Storage (Hard Disk / SSD)', value: asset.hardware?.hardisk },
            { label: 'Additional Hardware', value: asset.hardware?.additional_hardware },
          ]}
        />
      )}

      {activeTab === 'software' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard
            title="Operating System & Office"
            items={[
              { label: 'OS Name', value: asset.software?.os?.name },
              { label: 'OS Architecture', value: asset.software?.os?.bit },
              { label: 'OS Product Key', value: asset.software?.os?.product_key },
              { label: 'MS Office Version', value: asset.software?.office?.version },
              { label: 'Office License Key', value: asset.software?.office?.licence_key },
              { label: 'Other Installed Apps', value: asset.software?.other_app },
            ]}
          />
          <DetailCard
            title="Antivirus & Endpoint Security"
            items={[
              { label: 'Antivirus Name', value: asset.software?.antivirus?.name },
              { label: 'Product Key', value: asset.software?.antivirus?.product_key },
              { label: 'Start Date', value: asset.software?.antivirus?.start_date },
              { label: 'Expiry Date', value: asset.software?.antivirus?.expiry_date },
              { label: 'Last Signature Update', value: asset.software?.antivirus?.last_update },
            ]}
          />
        </div>
      )}

      {activeTab === 'procurement' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard
            title="Procurement & Financials"
            items={[
              { label: 'Supplier / Vendor', value: asset.procurement?.supplier },
              { label: 'CAPEX Number', value: asset.procurement?.capex_no },
              { label: 'PO Number', value: asset.procurement?.po_no },
              { label: 'PO Date', value: asset.procurement?.po_date },
              { label: 'Invoice Number', value: asset.procurement?.invoice_no },
              { label: 'Purchase Amount', value: asset.procurement?.amount ? `RM ${Number(asset.procurement.amount).toFixed(2)}` : '-' },
              { label: 'Warranty Expiry', value: asset.procurement?.warranty },
            ]}
          />
          <DetailCard
            title="Metadata & Remarks"
            items={[
              { label: 'Remark 1', value: asset.metadata?.remark1 },
              { label: 'Remark 2', value: asset.metadata?.remark2 },
              { label: 'File Sequence', value: asset.metadata?.file_seq },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function DetailCard({ title, items }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
        {title}
      </h3>
      <dl className="space-y-3 text-sm">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-3 gap-2">
            <dt className="text-slate-500 font-medium">{item.label}</dt>
            <dd className="col-span-2 text-slate-900 dark:text-slate-200 font-medium break-words">
              {item.value || <span className="text-slate-400 font-normal">Not specified</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
