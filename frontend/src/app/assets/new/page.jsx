// frontend/src/app/assets/new/page.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AssetService } from '../../../services/api';

function getInitialForm() {
  return {
    documentId: '',
    core_details: {
      asset_no: '',
      serial: '',
      type: 'Laptop',
      manufacturer: '',
      model: '',
      comp_name: '',
      ad: '',
      box_locate: '',
    },
    assignment: {
      user: '',
      dept: 'IT',
      company: '',
      location: '',
      last_use: '',
    },
    hardware: {
      processor: '',
      ram: '',
      hardisk: '',
      additional_hardware: '',
    },
    software: {
      os: { name: '', bit: '64-bit', product_key: '' },
      office: { version: '', licence_key: '' },
      antivirus: {
        name: '',
        product_key: '',
        start_date: '',
        expiry_date: '',
        last_update: '',
      },
      other_app: '',
    },
    procurement: {
      supplier: '',
      capex_no: '',
      po_no: '',
      po_date: '',
      invoice_no: '',
      amount: 0,
      warranty: '',
    },
    metadata: {
      remark1: '',
      remark2: '',
      file_seq: '',
    },
  };
}

export default function NewAssetPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(getInitialForm);
  const [saving, setSaving] = useState(false);

  const handleChange = (section, field, value, subSection = null) => {
    setFormData((prev) => {
      if (subSection) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [subSection]: { ...prev[section][subSection], [field]: value },
          },
        };
      }
      return {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      };
    });
  };

  const handleClearForm = () => {
    setFormData(getInitialForm());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        documentId: formData.core_details.asset_no.trim(),
      };
      await AssetService.createAsset(payload);
      setFormData(getInitialForm());
      router.push('/');
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Register New IT Asset
          </h2>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Complete all relevant hardware, software, procurement, and metadata fields below.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClearForm}
            className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition"
          >
            Clear Form
          </button>
          <Link
            href="/"
            onClick={handleClearForm}
            className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition"
          >
            {saving ? 'Saving Asset...' : 'Save Asset'}
          </button>
        </div>
      </div>

      {/* 1. Core Details */}
      <FormSection title="1. Core Asset Details">
        <Input
          label="Asset Number *"
          required
          placeholder="e.g., IT-LAP-2026-001"
          value={formData.core_details.asset_no}
          onChange={(v) => handleChange('core_details', 'asset_no', v)}
        />
        <Input
          label="Serial Number"
          placeholder="e.g., SN12345678"
          value={formData.core_details.serial}
          onChange={(v) => handleChange('core_details', 'serial', v)}
        />
        <Input
          label="Asset Type"
          placeholder="e.g., Laptop, Desktop, Server, Monitor"
          value={formData.core_details.type}
          onChange={(v) => handleChange('core_details', 'type', v)}
        />
        <Input
          label="Manufacturer"
          placeholder="e.g., HP, Dell, Lenovo"
          value={formData.core_details.manufacturer}
          onChange={(v) => handleChange('core_details', 'manufacturer', v)}
        />
        <Input
          label="Model"
          placeholder="e.g., Victus 16 / Latitude 5440"
          value={formData.core_details.model}
          onChange={(v) => handleChange('core_details', 'model', v)}
        />
        <Input
          label="Computer Name"
          placeholder="e.g., PC-IT-001"
          value={formData.core_details.comp_name}
          onChange={(v) => handleChange('core_details', 'comp_name', v)}
        />
        <Input
          label="Active Directory"
          placeholder="e.g., Joined - corp.local"
          value={formData.core_details.ad}
          onChange={(v) => handleChange('core_details', 'ad', v)}
        />
        <Input
          label="Box Location"
          placeholder="e.g., Store Room Rack B2"
          value={formData.core_details.box_locate}
          onChange={(v) => handleChange('core_details', 'box_locate', v)}
        />
      </FormSection>

      {/* 2. Assignment */}
      <FormSection title="2. User Assignment">
        <Input
          label="Assigned Employee"
          placeholder="e.g., ALI BIN ABU"
          value={formData.assignment.user}
          onChange={(v) => handleChange('assignment', 'user', v)}
        />
        <Input
          label="Department"
          placeholder="e.g., IT, Finance, HR, Operations"
          value={formData.assignment.dept}
          onChange={(v) => handleChange('assignment', 'dept', v)}
        />
        <Input
          label="Company Name"
          placeholder="e.g., HQ Sdn Bhd"
          value={formData.assignment.company}
          onChange={(v) => handleChange('assignment', 'company', v)}
        />
        <Input
          label="Physical Location"
          placeholder="e.g., Level 3, Cyberjaya"
          value={formData.assignment.location}
          onChange={(v) => handleChange('assignment', 'location', v)}
        />
        <Input
          label="Last Use Date"
          type="date"
          value={formData.assignment.last_use}
          onChange={(v) => handleChange('assignment', 'last_use', v)}
        />
      </FormSection>

      {/* 3. Hardware */}
      <FormSection title="3. Hardware Specifications">
        <Input
          label="Processor"
          placeholder="e.g., Intel Core i7-13700H"
          value={formData.hardware.processor}
          onChange={(v) => handleChange('hardware', 'processor', v)}
        />
        <Input
          label="RAM"
          placeholder="e.g., 16GB DDR5"
          value={formData.hardware.ram}
          onChange={(v) => handleChange('hardware', 'ram', v)}
        />
        <Input
          label="Storage"
          placeholder="e.g., 512GB NVMe SSD"
          value={formData.hardware.hardisk}
          onChange={(v) => handleChange('hardware', 'hardisk', v)}
        />
        <Input
          label="Additional Hardware"
          placeholder="e.g., Wireless Mouse, Docking Station"
          value={formData.hardware.additional_hardware}
          onChange={(v) => handleChange('hardware', 'additional_hardware', v)}
        />
      </FormSection>

      {/* 4. Software — OS & Office */}
      <FormSection title="4. Software — Operating System & Office">
        <Input
          label="OS Name"
          placeholder="e.g., Windows 11 Pro"
          value={formData.software.os.name}
          onChange={(v) => handleChange('software', 'name', v, 'os')}
        />
        <Input
          label="OS Architecture"
          placeholder="e.g., 64-bit"
          value={formData.software.os.bit}
          onChange={(v) => handleChange('software', 'bit', v, 'os')}
        />
        <Input
          label="OS Product Key"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          value={formData.software.os.product_key}
          onChange={(v) => handleChange('software', 'product_key', v, 'os')}
        />
        <Input
          label="MS Office Version"
          placeholder="e.g., Office Home & Business 2021"
          value={formData.software.office.version}
          onChange={(v) => handleChange('software', 'version', v, 'office')}
        />
        <Input
          label="Office License Key"
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          value={formData.software.office.licence_key}
          onChange={(v) => handleChange('software', 'licence_key', v, 'office')}
        />
        <Input
          label="Other Installed Software"
          placeholder="e.g., AutoCAD, Adobe Acrobat, SAP GUI"
          value={formData.software.other_app}
          onChange={(v) => handleChange('software', 'other_app', v)}
        />
      </FormSection>

      {/* 5. Software — Antivirus */}
      <FormSection title="5. Software — Antivirus Details">
        <Input
          label="Antivirus Name"
          placeholder="e.g., CrowdStrike / Kaspersky / Sophos"
          value={formData.software.antivirus.name}
          onChange={(v) => handleChange('software', 'name', v, 'antivirus')}
        />
        <Input
          label="Antivirus Product Key"
          placeholder="Enter AV license key"
          value={formData.software.antivirus.product_key}
          onChange={(v) => handleChange('software', 'product_key', v, 'antivirus')}
        />
        <Input
          label="License Start Date"
          type="date"
          value={formData.software.antivirus.start_date}
          onChange={(v) => handleChange('software', 'start_date', v, 'antivirus')}
        />
        <Input
          label="License Expiry Date"
          type="date"
          value={formData.software.antivirus.expiry_date}
          onChange={(v) => handleChange('software', 'expiry_date', v, 'antivirus')}
        />
        <Input
          label="Last AV Update Date"
          type="date"
          value={formData.software.antivirus.last_update}
          onChange={(v) => handleChange('software', 'last_update', v, 'antivirus')}
        />
      </FormSection>

      {/* 6. Procurement */}
      <FormSection title="6. Procurement Details">
        <Input
          label="Supplier / Vendor"
          placeholder="e.g., Ingram Micro / VSTECS"
          value={formData.procurement.supplier}
          onChange={(v) => handleChange('procurement', 'supplier', v)}
        />
        <Input
          label="CAPEX Number"
          placeholder="e.g., CAPEX-2026-045"
          value={formData.procurement.capex_no}
          onChange={(v) => handleChange('procurement', 'capex_no', v)}
        />
        <Input
          label="Purchase Order Number"
          placeholder="e.g., PO-2026-0089"
          value={formData.procurement.po_no}
          onChange={(v) => handleChange('procurement', 'po_no', v)}
        />
        <Input
          label="Purchase Order Date"
          type="date"
          value={formData.procurement.po_date}
          onChange={(v) => handleChange('procurement', 'po_date', v)}
        />
        <Input
          label="Invoice Number"
          placeholder="e.g., INV-99412"
          value={formData.procurement.invoice_no}
          onChange={(v) => handleChange('procurement', 'invoice_no', v)}
        />
        <Input
          label="Purchase Amount"
          type="number"
          step="0.01"
          value={formData.procurement.amount}
          onChange={(v) => handleChange('procurement', 'amount', parseFloat(v) || 0)}
        />
        <Input
          label="Warranty Details"
          placeholder="e.g., 3 Years Onsite"
          value={formData.procurement.warranty}
          onChange={(v) => handleChange('procurement', 'warranty', v)}
        />
      </FormSection>

      {/* 7. Metadata */}
      <FormSection title="7. Metadata & Remarks">
        <Input
          label="Remark 1"
          placeholder="General note 1"
          value={formData.metadata.remark1}
          onChange={(v) => handleChange('metadata', 'remark1', v)}
        />
        <Input
          label="Remark 2"
          placeholder="General note 2"
          value={formData.metadata.remark2}
          onChange={(v) => handleChange('metadata', 'remark2', v)}
        />
        <Input
          label="File Sequence"
          placeholder="e.g., FILE-IT-2026-A1"
          value={formData.metadata.file_seq}
          onChange={(v) => handleChange('metadata', 'file_seq', v)}
        />
      </FormSection>
    </form>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700">
      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 pb-2.5 border-b border-slate-200 dark:border-slate-700">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required = false, placeholder = '', step }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
