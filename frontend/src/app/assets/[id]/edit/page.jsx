'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AssetService } from '../../../../services/api';
import AssetPhotoField from '../../AssetPhotoField';

const ASSET_TYPES = ['Laptop', 'Desktop', 'Server', 'Monitor'];
const DEPARTMENTS = ['IT', 'Finance', 'HR', 'Operations'];
const ARCHITECTURES = ['64-bit', '32-bit', 'ARM64'];
const AD_OPTIONS = ['Joined - corp.company.my', 'Not joined', 'Workgroup'];

const todayLocal = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const fieldId = (path) => `edit-${path.replace(/\./g, '-')}`;

function validate(data) {
  const errors = {};
  const today = todayLocal();
  const assignment = data.assignment || {};
  const software = data.software || {};
  const antivirus = software.antivirus || {};
  const procurement = data.procurement || {};
  const dateOnly = (value) => String(value || '').slice(0, 10);

  if (assignment.last_use && dateOnly(assignment.last_use) > today) {
    errors['assignment.last_use'] = 'Last used date cannot be in the future.';
  }
  if (
    antivirus.start_date &&
    antivirus.expiry_date &&
    dateOnly(antivirus.expiry_date) < dateOnly(antivirus.start_date)
  ) {
    errors['software.antivirus.expiry_date'] =
      'Expiry date must be on or after the start date.';
  }
  if (procurement.po_date && dateOnly(procurement.po_date) > today) {
    errors['procurement.po_date'] = 'Purchase order date cannot be in the future.';
  }
  if (
    procurement.amount !== '' &&
    procurement.amount != null &&
    (!Number.isFinite(Number(procurement.amount)) || Number(procurement.amount) < 0)
  ) {
    errors['procurement.amount'] = 'Enter an amount of 0 or more.';
  }
  return errors;
}

const optionsWithCurrent = (current, options) => {
  const value = String(current ?? '');
  return value && !options.includes(value) ? [value, ...options] : options;
};

export default function EditAssetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-600" role="status">Loading asset for editing...</div>}>
      <EditAssetContent />
    </Suspense>
  );
}

function EditAssetContent() {
  const { id } = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState(null);
  const [originalData, setOriginalData] = useState('');
  const [loadedId, setLoadedId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoVersion, setPhotoVersion] = useState(0);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const cancelRef = useRef(null);
  const loading = loadedId !== id;
  const isDirty = Boolean(
    formData &&
    originalData &&
    (JSON.stringify(formData) !== originalData || selectedPhoto || photoBusy)
  );

  useEffect(() => {
    if (!id) return undefined;
    let active = true;

    AssetService.getAssetById(decodeURIComponent(id))
      .then((res) => {
        if (!active) return;
        const data = res.data;
        setFormData(data);
        setOriginalData(JSON.stringify(data));
        setHasPhoto(Boolean(data.imageId));
        setSelectedPhoto(null);
        setLoadError('');
        setLoadedId(id);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err.message || 'Could not load this asset.');
          setLoadedId(id);
        }
      });

    return () => {
      active = false;
    };
  }, [id, loadAttempt]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleLinkClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const link = event.target.closest('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash === window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(`${destination.pathname}${destination.search}${destination.hash}`);
      setConfirmDiscard(true);
    };

    document.addEventListener('click', handleLinkClick, true);
    return () => document.removeEventListener('click', handleLinkClick, true);
  }, [isDirty]);

  useEffect(() => {
    if (!confirmDiscard) return undefined;
    cancelRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === 'Escape') setConfirmDiscard(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [confirmDiscard]);

  const handleChange = (section, field, value, subSection = null) => {
    setFormData((prev) => {
      if (subSection) {
        return {
          ...prev,
          [section]: {
            ...(prev[section] || {}),
            [subSection]: { ...(prev[section]?.[subSection] || {}), [field]: value },
          },
        };
      }
      return {
        ...prev,
        [section]: { ...(prev[section] || {}), [field]: value },
      };
    });
    const path = subSection ? `${section}.${subSection}.${field}` : `${section}.${field}`;
    setErrors((previous) => {
      if (!previous[path]) return previous;
      const { [path]: _removed, ...remaining } = previous;
      return remaining;
    });
    setSaveError('');
  };

  const requestCancel = () => {
    if (isDirty) {
      setPendingNavigation(null);
      setConfirmDiscard(true);
    } else {
      router.push(`/assets/${encodeURIComponent(formData.documentId)}`);
    }
  };

  const discardChanges = () => {
    const destination =
      pendingNavigation || `/assets/${encodeURIComponent(formData.documentId)}`;
    setConfirmDiscard(false);
    setPendingNavigation(null);
    router.push(destination);
  };

  const handlePhotoUpload = async () => {
    if (!selectedPhoto || photoBusy || saving) return;
    setPhotoBusy(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      const result = await AssetService.uploadAssetImage(formData.documentId, selectedPhoto);
      setHasPhoto(true);
      setSelectedPhoto(null);
      setPhotoVersion((version) => version + 1);
      setPhotoMessage(result.warning || 'Asset photo uploaded successfully.');
    } catch (err) {
      setPhotoError(err.message || 'Could not upload the asset photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoRemoval = async () => {
    if (photoBusy || saving) return;
    setPhotoBusy(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      const result = await AssetService.deleteAssetImage(formData.documentId);
      setHasPhoto(false);
      setSelectedPhoto(null);
      setPhotoVersion((version) => version + 1);
      setPhotoMessage(result.message || 'Asset photo removed.');
    } catch (err) {
      setPhotoError(err.message || 'Could not remove the asset photo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || photoBusy) return;
    setSaveError('');

    const validationErrors = validate(formData);
    setErrors(validationErrors);
    const firstInvalidPath = Object.keys(validationErrors)[0];
    if (firstInvalidPath) {
      document.getElementById(fieldId(firstInvalidPath))?.focus();
      return;
    }

    setSaving(true);
    try {
      const assetNo = String(formData.core_details.asset_no ?? '').trim();
      const amount = formData.procurement?.amount;
      const payload = {
        ...formData,
        core_details: { ...formData.core_details, asset_no: assetNo },
        procurement: {
          ...formData.procurement,
          amount: amount === '' || amount == null ? null : Number(amount),
        },
      };
      if (selectedPhoto) {
        try {
          await AssetService.uploadAssetImage(formData.documentId, selectedPhoto);
          setHasPhoto(true);
          setSelectedPhoto(null);
          setPhotoVersion((version) => version + 1);
        } catch (photoErr) {
          setPhotoError(photoErr.message || 'Could not upload the selected asset photo.');
          return;
        }
      }
      const result = await AssetService.updateAsset(formData.documentId, payload);
      router.push(`/assets/${encodeURIComponent(result.data.documentId)}`);
    } catch (err) {
      setSaveError(
        err.message
          ? `Could not save changes: ${err.message}. Your edits are still here; try again.`
          : 'Could not save changes. Your edits are still here; check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-8 text-slate-600 dark:text-slate-300" role="status">
        Loading asset for editing...
      </div>
    );
  }

  if (loadError || !formData) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/40">
        <h2 className="text-lg font-bold text-red-800 dark:text-red-300">
          {loadError === 'Asset not found' ? 'Asset not found' : 'Could not load this asset'}
        </h2>
        <p className="mt-2 text-sm text-red-800 dark:text-red-300">
          {loadError || 'The asset record could not be loaded.'}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setLoadError('');
              setLoadedId(null);
              setLoadAttempt((attempt) => attempt + 1);
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to inventory
          </button>
        </div>
      </div>
    );
  }

  const idOptions = (path, choices) => optionsWithCurrent(
    path.split('.').reduce((value, key) => value?.[key], formData),
    choices
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-300 bg-white p-5 shadow-xs dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Edit Asset: {formData.core_details?.asset_no || 'No asset number'}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Update hardware, software, assignment, or procurement details. Asset number is optional.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={requestCancel}
            disabled={saving || photoBusy}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || photoBusy}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Updating...' : 'Update Asset'}
          </button>
        </div>
      </div>

      {saveError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-bold">Asset not updated</p>
          <p className="mt-1">{saveError}</p>
        </div>
      )}

      <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-xs dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <AssetPhotoField
            key={
              selectedPhoto
                ? `${selectedPhoto.name}-${selectedPhoto.lastModified}`
                : `saved-${photoVersion}`
            }
            id="edit-asset-photo"
            file={selectedPhoto}
            imageUrl={
              hasPhoto
                ? AssetService.getAssetImageUrl(formData.documentId, photoVersion)
                : undefined
            }
            disabled={photoBusy || saving}
            onFileChange={(file) => {
              setSelectedPhoto(file);
              setPhotoError('');
              setPhotoMessage('');
            }}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePhotoUpload}
              disabled={!selectedPhoto || photoBusy || saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {photoBusy ? 'Saving photo...' : hasPhoto ? 'Replace photo' : 'Upload photo'}
            </button>
            {hasPhoto && (
              <button
                type="button"
                onClick={handlePhotoRemoval}
                disabled={photoBusy || saving}
                className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Remove photo
              </button>
            )}
            {photoError && <p role="alert" className="w-full text-sm font-medium text-red-700 dark:text-red-400">{photoError}</p>}
            {photoMessage && <p role="status" className="w-full text-sm text-emerald-700 dark:text-emerald-400">{photoMessage}</p>}
          </div>
        </div>
      </section>

      <FormSection title="1. Core Asset Details">
        <Input path="core_details.asset_no" label="Asset number (optional)"
          value={formData.core_details?.asset_no} onChange={(v) => handleChange('core_details', 'asset_no', v)} />
        <Input path="core_details.serial" label="Serial number"
          value={formData.core_details?.serial} onChange={(v) => handleChange('core_details', 'serial', v)} />
        <Input path="core_details.type" label="Asset type" type="select" options={idOptions('core_details.type', ASSET_TYPES)}
          value={formData.core_details?.type} onChange={(v) => handleChange('core_details', 'type', v)} />
        <Input path="core_details.manufacturer" label="Manufacturer"
          value={formData.core_details?.manufacturer} onChange={(v) => handleChange('core_details', 'manufacturer', v)} />
        <Input path="core_details.model" label="Model"
          value={formData.core_details?.model} onChange={(v) => handleChange('core_details', 'model', v)} />
        <Input path="core_details.comp_name" label="Computer name"
          value={formData.core_details?.comp_name} onChange={(v) => handleChange('core_details', 'comp_name', v)} />
        <Input path="core_details.ad" label="Active Directory status" type="select" options={idOptions('core_details.ad', AD_OPTIONS)}
          value={formData.core_details?.ad} onChange={(v) => handleChange('core_details', 'ad', v)} />
        <Input path="core_details.box_locate" label="Storage box location"
          value={formData.core_details?.box_locate} onChange={(v) => handleChange('core_details', 'box_locate', v)} />
      </FormSection>

      <FormSection title="2. User Assignment">
        <Input path="assignment.user" label="Assigned user"
          value={formData.assignment?.user} onChange={(v) => handleChange('assignment', 'user', v)} />
        <Input path="assignment.dept" label="Department" type="select" options={idOptions('assignment.dept', DEPARTMENTS)}
          value={formData.assignment?.dept} onChange={(v) => handleChange('assignment', 'dept', v)} />
        <Input path="assignment.company" label="Company"
          value={formData.assignment?.company} onChange={(v) => handleChange('assignment', 'company', v)} />
        <Input path="assignment.location" label="Physical location"
          value={formData.assignment?.location} onChange={(v) => handleChange('assignment', 'location', v)} />
        <Input path="assignment.last_use" label="Last used date" type="date" max={todayLocal()}
          error={errors['assignment.last_use']} value={formData.assignment?.last_use}
          onChange={(v) => handleChange('assignment', 'last_use', v)} />
      </FormSection>

      <FormSection title="3. Hardware Specifications">
        <Input path="hardware.processor" label="Processor"
          value={formData.hardware?.processor} onChange={(v) => handleChange('hardware', 'processor', v)} />
        <Input path="hardware.ram" label="Memory (RAM)"
          value={formData.hardware?.ram} onChange={(v) => handleChange('hardware', 'ram', v)} />
        <Input path="hardware.hardisk" label="Storage"
          value={formData.hardware?.hardisk} onChange={(v) => handleChange('hardware', 'hardisk', v)} />
        <Input path="hardware.additional_hardware" label="Accessories and peripherals"
          value={formData.hardware?.additional_hardware} onChange={(v) => handleChange('hardware', 'additional_hardware', v)} />
      </FormSection>

      <FormSection title="4. Software — Operating System & Office">
        <Input path="software.os.name" label="Operating system"
          value={formData.software?.os?.name} onChange={(v) => handleChange('software', 'name', v, 'os')} />
        <Input path="software.os.bit" label="OS architecture" type="select" options={idOptions('software.os.bit', ARCHITECTURES)}
          value={formData.software?.os?.bit} onChange={(v) => handleChange('software', 'bit', v, 'os')} />
        <Input path="software.os.product_key" label="OS product key" type="masked"
          value={formData.software?.os?.product_key} onChange={(v) => handleChange('software', 'product_key', v, 'os')} />
        <Input path="software.office.version" label="Microsoft Office version"
          value={formData.software?.office?.version} onChange={(v) => handleChange('software', 'version', v, 'office')} />
        <Input path="software.office.licence_key" label="Office licence key" type="masked"
          value={formData.software?.office?.licence_key} onChange={(v) => handleChange('software', 'licence_key', v, 'office')} />
        <Input path="software.other_app" label="Other installed software"
          value={formData.software?.other_app} onChange={(v) => handleChange('software', 'other_app', v)} />
      </FormSection>

      <FormSection title="5. Software — Antivirus Details">
        <Input path="software.antivirus.name" label="Antivirus"
          value={formData.software?.antivirus?.name} onChange={(v) => handleChange('software', 'name', v, 'antivirus')} />
        <Input path="software.antivirus.product_key" label="Antivirus product key" type="masked"
          value={formData.software?.antivirus?.product_key} onChange={(v) => handleChange('software', 'product_key', v, 'antivirus')} />
        <Input path="software.antivirus.start_date" label="Antivirus start date" type="date"
          value={formData.software?.antivirus?.start_date} onChange={(v) => handleChange('software', 'start_date', v, 'antivirus')} />
        <Input path="software.antivirus.expiry_date" label="Antivirus expiry date" type="date"
          min={formData.software?.antivirus?.start_date?.slice(0, 10) || undefined}
          error={errors['software.antivirus.expiry_date']} value={formData.software?.antivirus?.expiry_date}
          onChange={(v) => handleChange('software', 'expiry_date', v, 'antivirus')} />
        <Input path="software.antivirus.last_update" label="Antivirus last update" type="date"
          value={formData.software?.antivirus?.last_update} onChange={(v) => handleChange('software', 'last_update', v, 'antivirus')} />
      </FormSection>

      <FormSection title="6. Procurement Details">
        <Input path="procurement.supplier" label="Supplier / Vendor"
          value={formData.procurement?.supplier} onChange={(v) => handleChange('procurement', 'supplier', v)} />
        <Input path="procurement.capex_no" label="CAPEX number"
          value={formData.procurement?.capex_no} onChange={(v) => handleChange('procurement', 'capex_no', v)} />
        <Input path="procurement.po_no" label="Purchase order number"
          value={formData.procurement?.po_no} onChange={(v) => handleChange('procurement', 'po_no', v)} />
        <Input path="procurement.po_date" label="Purchase order date" type="date" max={todayLocal()}
          error={errors['procurement.po_date']} value={formData.procurement?.po_date}
          onChange={(v) => handleChange('procurement', 'po_date', v)} />
        <Input path="procurement.invoice_no" label="Invoice number"
          value={formData.procurement?.invoice_no} onChange={(v) => handleChange('procurement', 'invoice_no', v)} />
        <Input path="procurement.amount" label="Purchase amount (RM)" type="number" min="0" step="0.01"
          error={errors['procurement.amount']} value={formData.procurement?.amount}
          onChange={(v) => handleChange('procurement', 'amount', v)} />
        <Input path="procurement.warranty" label="Warranty"
          value={formData.procurement?.warranty} onChange={(v) => handleChange('procurement', 'warranty', v)} />
      </FormSection>

      <FormSection title="7. Metadata & Remarks">
        <Input path="metadata.remark1" label="Primary remark"
          value={formData.metadata?.remark1} onChange={(v) => handleChange('metadata', 'remark1', v)} />
        <Input path="metadata.remark2" label="Secondary remark"
          value={formData.metadata?.remark2} onChange={(v) => handleChange('metadata', 'remark2', v)} />
        <Input path="metadata.file_seq" label="Physical file sequence"
          value={formData.metadata?.file_seq} onChange={(v) => handleChange('metadata', 'file_seq', v)} />
      </FormSection>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={requestCancel}
          disabled={saving || photoBusy}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || photoBusy}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Updating...' : 'Update Asset'}
        </button>
      </div>

      {confirmDiscard && (
        <DiscardChangesDialog
          cancelRef={cancelRef}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={discardChanges}
        />
      )}
    </form>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-xs dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-4 border-b border-slate-200 pb-2.5 text-base font-extrabold text-slate-900 dark:border-slate-700 dark:text-white">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Input({ path, label, value, onChange, type = 'text', options, error, required, min, max, step }) {
  const [reveal, setReveal] = useState(false);
  const id = fieldId(path);
  const describedBy = error ? `${id}-error` : undefined;
  const inputValue = type === 'date' ? String(value ?? '').slice(0, 10) : value ?? '';
  const className = `w-full rounded-lg border px-3.5 py-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white ${
    error ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
  }`;
  const optionsId = `${id}-options`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {type === 'select' ? (
        <>
          <input
            id={id}
            name={path}
            type="text"
            list={optionsId}
            value={inputValue}
            onChange={(event) => onChange(event.target.value)}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
          <datalist id={optionsId}>
            {options.map((option) => <option key={option} value={option} />)}
          </datalist>
        </>
      ) : type === 'masked' ? (
        <div className="relative">
          <input
            id={id}
            name={path}
            type="text"
            value={inputValue}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            style={{ WebkitTextSecurity: reveal ? 'none' : 'disc' }}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${className} pr-16`}
          />
          <button
            type="button"
            onClick={() => setReveal((current) => !current)}
            aria-pressed={reveal}
            aria-label={`${reveal ? 'Hide' : 'Show'} ${label}`}
            className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-blue-700 dark:text-blue-400"
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
      ) : (
        <input
          id={id}
          name={path}
          type={type}
          value={inputValue}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={className}
        />
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

function DiscardChangesDialog({ cancelRef, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        aria-describedby="discard-body"
        className="w-full max-w-md rounded-xl border border-slate-300 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
      >
        <h2 id="discard-title" className="text-lg font-bold text-slate-900 dark:text-white">Discard your changes?</h2>
        <p id="discard-body" className="mt-2 text-sm text-slate-700 dark:text-slate-300">
          You have unsaved changes. If you leave now, they will be lost.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-slate-700"
          >
            Discard and leave
          </button>
        </div>
      </div>
    </div>
  );
}
