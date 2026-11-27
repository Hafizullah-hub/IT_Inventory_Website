// frontend/src/app/assets/new/page.js
'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AssetService } from '../../../services/api';
import AssetPhotoField from '../AssetPhotoField';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const DEFAULTS_KEY = 'it_inventory_defaults';

const ASSET_TYPES = ['Laptop', 'Desktop', 'Server', 'Monitor'];
const DEPARTMENTS = ['IT', 'Finance', 'HR', 'Operations'];
const ARCHITECTURES = ['64-bit', '32-bit', 'ARM64'];
const AD_OPTIONS = ['Joined - corp.company.my', 'Not joined', 'Workgroup'];

const SECTIONS = [
  { id: 'core_details', title: 'Core asset details',
    description: 'Add the inventory details you have. All fields are optional.' },
  { id: 'assignment', title: 'User and department',
    description: 'Who has the device and where it is.' },
  { id: 'hardware', title: 'Hardware specifications',
    description: 'Processor, memory, storage and accessories.' },
  { id: 'software', title: 'Software and endpoint security',
    description: 'Operating system, Office, antivirus and licence keys.' },
  { id: 'procurement', title: 'Procurement and finance',
    description: 'Purchase and warranty details for audit.' },
  { id: 'metadata', title: 'Remarks and filing',
    description: 'Free-text notes and physical file reference.' },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const createInitialState = (defaults = {}) => ({
  documentId: '',
  core_details: {
    asset_no: '',
    serial: '',
    type: 'Laptop',
    manufacturer: '',
    model: '',
    comp_name: '',
    ad: defaults.ad || 'Joined - corp.company.my',
    box_locate: '',
  },
  assignment: {
    user: '',
    dept: 'IT',
    company: defaults.company || 'TechCorp Malaysia Sdn Bhd',
    location: '',
    last_use: '',
  },
  hardware: { processor: '', ram: '', hardisk: '', additional_hardware: '' },
  software: {
    os: {
      name: defaults.osName || 'Windows 11 Pro',
      bit: defaults.osBit || '64-bit',
      product_key: '',
    },
    office: {
      version: defaults.officeVersion || 'Microsoft 365 Apps for Enterprise',
      licence_key: '',
    },
    antivirus: {
      name: defaults.antivirusName || 'CrowdStrike Falcon Sensor',
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
    amount: '', // kept as a string so the field can be empty
    warranty: defaults.warranty || '3 Years Onsite Support',
  },
  metadata: { remark1: '', remark2: '', file_seq: '' },
});

const getIn = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

const setIn = (obj, keys, value) => {
  const [k, ...rest] = keys;
  return { ...obj, [k]: rest.length ? setIn(obj[k], rest, value) : value };
};

const idOf = (path) => 'f-' + path.replace(/\./g, '-');

const todayLocal = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

// Keep fields shared across a batch (same model, PO, supplier...), clear per-device ones.
const nextInBatch = (data) => {
  const next = JSON.parse(JSON.stringify(data));
  next.documentId = '';
  next.core_details.asset_no = '';
  next.core_details.serial = '';
  next.core_details.comp_name = '';
  next.assignment.user = '';
  next.software.os.product_key = '';
  next.software.office.licence_key = '';
  next.software.antivirus.product_key = '';
  return next;
};

function validate(data) {
  const e = {};
  const today = todayLocal();
  const { assignment: a, software: s, procurement: p } = data;

  if (a.last_use && a.last_use > today)
    e['assignment.last_use'] = 'Last used date cannot be in the future.';

  const { start_date, expiry_date } = s.antivirus;
  if (start_date && expiry_date && expiry_date < start_date)
    e['software.antivirus.expiry_date'] = 'Expiry date must be on or after the start date.';

  if (p.po_date && p.po_date > today)
    e['procurement.po_date'] = 'Purchase order date cannot be in the future.';

  if (p.amount !== '' && (Number.isNaN(Number(p.amount)) || Number(p.amount) < 0))
    e['procurement.amount'] = 'Enter an amount of 0 or more.';

  return e;
}

/* ------------------------------------------------------------------ */
/* Styling                                                             */
/* ------------------------------------------------------------------ */

const inputBase =
  'w-full min-h-11 md:min-h-0 px-3.5 py-2 border rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm ' +
  'focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';
const inputOk = 'border-slate-300 dark:border-slate-600';
const inputBad = 'border-red-500 dark:border-red-400';
const labelClass = 'block text-sm font-medium text-slate-800 dark:text-slate-200 mb-1';
const hintClass = 'mt-1 text-xs text-slate-600 dark:text-slate-400';
const errorClass = 'mt-1 text-xs font-medium text-red-700 dark:text-red-400';
const btnBase =
  'min-h-11 px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer transition ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

/* ------------------------------------------------------------------ */
/* Small components (defined outside the page so inputs never remount) */
/* ------------------------------------------------------------------ */

function Field({
  path, label, value, onChange, onBlur, error, hint, required,
  type = 'text', options, list, placeholder, min, max, step, prefix, span = '',
}) {
  const id = idOf(path);
  const [reveal, setReveal] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const common = {
    id,
    name: path,
    value,
    onChange: (e) => onChange(path, e.target.value),
    onBlur,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    'aria-required': required ? true : undefined,
  };
  const cls = `${inputBase} ${error ? inputBad : inputOk}`;

  let control;
  if (type === 'select') {
    const optionsId = `${id}-options`;
    control = (
      <>
        <input {...common} type="text" list={optionsId} className={cls} />
        <datalist id={optionsId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </>
    );
  } else if (type === 'secret') {
    control = (
      <div className="relative">
        <input
          {...common}
          type={reveal ? 'text' : 'password'}
          autoComplete="off"
          placeholder={placeholder}
          className={`${cls} pr-16`}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          aria-pressed={reveal}
          aria-label={`${reveal ? 'Hide' : 'Show'} ${label}`}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-blue-700 dark:text-blue-400 cursor-pointer"
        >
          {reveal ? 'Hide' : 'Show'}
        </button>
      </div>
    );
  } else if (prefix) {
    control = (
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-500"
        >
          {prefix}
        </span>
        <input {...common} type={type} min={min} step={step} placeholder={placeholder} className={`${cls} pl-11`} />
      </div>
    );
  } else if (list) {
    control = (
      <input {...common} type="text" list={list} placeholder={placeholder} className={cls} />
    );
  } else {
    control = (
      <input {...common} type={type} min={min} max={max} step={step} placeholder={placeholder} className={cls} />
    );
  }

  return (
    <div className={span}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>}
      </label>
      {control}
      {error ? (
        <p id={`${id}-error`} role="alert" className={errorClass}>{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className={hintClass}>{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ section, open, onToggle, errorCount, children }) {
  const headingId = `sec-${section.id}-title`;
  const panelId = `sec-${section.id}-panel`;
  return (
    <section
      aria-labelledby={headingId}
      className="border border-slate-300 dark:border-slate-700 rounded-xl"
    >
      <h3 id={headingId} className="m-0">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <span>
            <span className="block text-base font-bold text-slate-900 dark:text-white">
              {section.title}
              {section.required ? null : (
                <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">Optional</span>
              )}
              {errorCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-red-700 dark:text-red-400">
                  {errorCount} {errorCount === 1 ? 'issue' : 'issues'} to fix
                </span>
              )}
            </span>
            <span className="block text-xs font-normal text-slate-600 dark:text-slate-400 mt-0.5">
              {section.description}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-5 pb-5 pt-1">
        {children}
      </div>
    </section>
  );
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl border border-slate-300 dark:border-slate-700"
      >
        <h2 id="confirm-title" className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p id="confirm-body" className="mt-2 text-sm text-slate-700 dark:text-slate-300">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${btnBase} border border-red-600 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function NewAssetPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [savedDefaults, setSavedDefaults] = useState({});
  const [formData, setFormData] = useState(() => createInitialState());
  const [assetPhoto, setAssetPhoto] = useState(null);
  const [savedAssetId, setSavedAssetId] = useState('');

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState({ core_details: true });
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState(null); // { message, undo? }

  const summaryRef = useRef(null);
  const skipGuard = useRef(false);

  /* ---- load saved defaults before showing the form (no flash) ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSavedDefaults(parsed);
        setFormData(createInitialState(parsed));
      }
    } catch (e) {
      console.warn('Could not read saved defaults:', e);
    } finally {
      setReady(true);
    }
  }, []);

  const baseline = useMemo(() => createInitialState(savedDefaults), [savedDefaults]);
  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(baseline) || Boolean(assetPhoto),
    [formData, baseline, assetPhoto]
  );

  /* ---- warn on tab close / refresh with unsaved changes ---- */
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (e) => {
      if (skipGuard.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ---- auto-dismiss toast ---- */
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---- move focus to the error summary after a failed submit ---- */
  useEffect(() => {
    if (attempt > 0) summaryRef.current?.focus();
  }, [attempt]);

  /* ---- field updates ---- */
  const setField = useCallback((path, value) => {
    setFormData((prev) => setIn(prev, path.split('.'), value));
    setErrors((prev) => {
      if (!prev[path]) return prev;
      const { [path]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const f = (path, extra = {}) => ({
    path,
    value: getIn(formData, path),
    onChange: setField,
    error: errors[path],
    ...extra,
  });

  /* ---- duplicate asset number check (needs AssetService.getAsset; skipped if absent) ---- */
  const checkAssetNo = async () => {
    const no = formData.core_details.asset_no.trim();
    if (!no || typeof AssetService.getAsset !== 'function') return;
    try {
      const existing = await AssetService.getAsset(no);
      if (existing) {
        setErrors((prev) => ({
          ...prev,
          'core_details.asset_no': `Asset number ${no} is already registered. Use a different number.`,
        }));
      }
    } catch (e) {
      // Not found (good) or offline. The server still rejects duplicates on save.
    }
  };

  /* ---- sections ---- */
  const toggleSection = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const allOpen = SECTIONS.every((s) => open[s.id]);
  const setAllSections = (value) =>
    setOpen(Object.fromEntries(SECTIONS.map((s) => [s.id, value])));

  const errorCountFor = (sectionId) =>
    Object.keys(errors).filter((p) => p.split('.')[0] === sectionId).length;

  const focusField = (path) => {
    const el = document.getElementById(idOf(path));
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus();
    }
  };

  /* ---- submit ---- */
  const submit = async (mode) => {
    if (saving || savedAssetId) return;
    setFormError('');

    const found = validate(formData);
    if (Object.keys(found).length) {
      setErrors(found);
      setOpen((prev) => {
        const next = { ...prev };
        Object.keys(found).forEach((p) => { next[p.split('.')[0]] = true; });
        return next;
      });
      setAttempt((n) => n + 1);
      return;
    }

    const assetNo = String(formData.core_details.asset_no || '').trim();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        documentId: assetNo || undefined,
        core_details: {
          ...formData.core_details,
          asset_no: assetNo,
          serial: formData.core_details.serial.trim(),
        },
        procurement: {
          ...formData.procurement,
          amount: formData.procurement.amount === '' ? null : Number(formData.procurement.amount),
        },
      };
      const createdAsset = await AssetService.createAsset(payload);
      if (assetPhoto) {
        try {
          await AssetService.uploadAssetImage(createdAsset.data.documentId, assetPhoto);
        } catch (photoError) {
          setSavedAssetId(createdAsset.data.documentId);
          setFormError(
            `Asset ${createdAsset.data.documentId} was saved, but its photo could not be uploaded: ${photoError.message}`
          );
          setAttempt((n) => n + 1);
          return;
        }
      }

      if (mode === 'another') {
        setFormData(nextInBatch(formData));
        setAssetPhoto(null);
        setErrors({});
        setAttempt(0);
        setToast({
          message: `Saved ${assetNo || 'asset without an asset number'}. Shared fields are kept for the next asset.`,
        });
        setTimeout(() => focusField('core_details.asset_no'), 0);
      } else {
        skipGuard.current = true;
        router.push('/');
      }
    } catch (err) {
      console.error('Create asset failed:', err);
      const msg = String(err?.message || '');
      if (assetNo && /exist|duplicate|already|409/i.test(msg)) {
        setErrors({ 'core_details.asset_no': `Asset number ${assetNo} is already registered. Use a different number.` });
        setOpen((p) => ({ ...p, core_details: true }));
      } else {
        setFormError(
          'The asset could not be saved. Your entries are still here. Check your connection and try again.'
        );
      }
      setAttempt((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  /* ---- reset (with undo) and exit (with confirmation) ---- */
  const handleReset = () => {
    const snapshot = formData;
    setFormData(baseline);
    setErrors({});
    setFormError('');
    setAttempt(0);
    setToast({
      message: 'Form reset.',
      undo: () => {
        setFormData(snapshot);
        setToast(null);
      },
    });
  };

  const requestExit = () => {
    if (isDirty) setConfirmExit(true);
    else router.push('/');
  };

  const confirmDiscard = () => {
    skipGuard.current = true;
    router.push('/');
  };

  const saveAsDefaults = () => {
    const d = {
      ad: formData.core_details.ad,
      company: formData.assignment.company,
      osName: formData.software.os.name,
      osBit: formData.software.os.bit,
      officeVersion: formData.software.office.version,
      antivirusName: formData.software.antivirus.name,
      warranty: formData.procurement.warranty,
    };
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
      setSavedDefaults(d);
      setToast({ message: 'Saved company, OS, Office, antivirus and warranty as your defaults.' });
    } catch (e) {
      setToast({ message: 'Could not save defaults. Browser storage is unavailable.' });
    }
  };

  const errorEntries = Object.entries(errors);
  const adOptions = AD_OPTIONS.includes(formData.core_details.ad)
    ? AD_OPTIONS
    : [formData.core_details.ad, ...AD_OPTIONS];

  if (!ready) {
    return (
      <div className="max-w-5xl mx-auto pb-12" role="status">
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading form...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            onClick={(e) => {
              if (isDirty) {
                e.preventDefault();
                setConfirmExit(true);
              }
            }}
            className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
          >
            &larr; Back to inventory
          </Link>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Register new IT asset</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            Fields with a chevron suggest common values. You can also type your own.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAllSections(!allOpen)}
            className="min-h-11 px-3 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            type="button"
            onClick={saveAsDefaults}
            className="min-h-11 px-3 text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Save as my defaults
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty}
            className="min-h-11 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
          >
            Reset form
          </button>
        </div>
      </div>

      {/* Suggestion lists */}
      <datalist id="brand-options">
        {['HP', 'Dell', 'Lenovo', 'HPE', 'Apple'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="ram-options">
        {['8GB DDR4', '16GB DDR4', '16GB DDR5', '32GB DDR5', '64GB DDR5', '128GB DDR5 ECC', '256GB DDR5 ECC'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="storage-options">
        {['256GB NVMe SSD', '512GB NVMe SSD', '1TB NVMe SSD', '4x 960GB SSD RAID5', '4x 1.92TB NVMe RAID10'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="av-options">
        {['CrowdStrike Falcon Sensor', 'Kaspersky Endpoint Security', 'Sophos Intercept X'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="supplier-options">
        {['VSTECS Astar Sdn Bhd', 'Ingram Micro Malaysia Sdn Bhd', 'SNS Network (M) Sdn Bhd', 'VADS Business Process Sdn Bhd', 'Jos Malaysia Sdn Bhd'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="os-options">
        {['Windows 11 Pro', 'Windows 10 Pro', 'Windows Server 2022', 'Windows Server 2019', 'macOS', 'Ubuntu 24.04 LTS'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="office-options">
        {['Microsoft 365 Apps for Enterprise', 'Office LTSC 2021', 'Office 2019 Professional Plus', 'Not installed'].map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="warranty-options">
        {['1 Year Onsite Support', '3 Years Onsite Support', '5 Years Onsite Support', 'Out of warranty'].map((v) => <option key={v} value={v} />)}
      </datalist>

      {/* Error summary */}
      {attempt > 0 && (formError || errorEntries.length > 0) && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-xl border border-red-300 dark:border-red-500/60 bg-red-50 dark:bg-red-950/40 p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <p className="text-sm font-bold text-red-800 dark:text-red-300">
            {savedAssetId
              ? 'Asset saved, but photo upload failed'
              : formError
                ? 'Asset not saved'
                : `Fix ${errorEntries.length} ${errorEntries.length === 1 ? 'issue' : 'issues'} before saving`}
          </p>
          {formError && <p className="mt-1 text-sm text-red-800 dark:text-red-300">{formError}</p>}
          {savedAssetId && (
            <Link
              href={`/assets/${encodeURIComponent(savedAssetId)}/edit`}
              className="mt-2 inline-block text-sm font-bold text-blue-700 underline dark:text-blue-300"
            >
              Open the saved asset to add its photo
            </Link>
          )}
          {errorEntries.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-red-800 dark:text-red-300">
              {errorEntries.map(([path, message]) => (
                <li key={path}>
                  <a
                    href={`#${idOf(path)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(path);
                    }}
                    className="underline font-medium"
                  >
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit('exit');
        }}
        className="space-y-4 bg-white dark:bg-slate-800 p-4 sm:p-8 rounded-xl shadow-xs border border-slate-300 dark:border-slate-700"
      >
        {/* 1. Core */}
        <Section section={SECTIONS[0]} open={!!open.core_details} onToggle={() => toggleSection('core_details')} errorCount={errorCountFor('core_details')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field {...f('core_details.asset_no', { onBlur: checkAssetNo })} label="Asset number"
              placeholder="e.g. IT-LAP-2026-051"/>
            <Field {...f('core_details.serial')} label="Serial number" placeholder="e.g. 5CG26051X3M"
              />
            <Field {...f('core_details.type')} label="Asset type" type="select" options={ASSET_TYPES} />
            <Field {...f('core_details.manufacturer')} label="Manufacturer" list="brand-options" placeholder="e.g. HP, Dell, Lenovo" />
            <Field {...f('core_details.model')} label="Model" placeholder="e.g. EliteBook 840 G10" />
            <Field {...f('core_details.comp_name')} label="Computer name" placeholder="e.g. MY-IT-LAP051" />
            <Field {...f('core_details.ad')} label="Active Directory status" type="select" options={adOptions} />
            <Field {...f('core_details.box_locate')} span="md:col-span-2" label="Storage box location"
              placeholder="e.g. IT Store Room - Rack A2"/>
            <AssetPhotoField
              key={assetPhoto ? `${assetPhoto.name}-${assetPhoto.lastModified}` : 'empty'}
              id="new-asset-photo"
              file={assetPhoto}
              onFileChange={setAssetPhoto}
              disabled={saving || Boolean(savedAssetId)}
              className="md:col-span-3"
            />
          </div>
        </Section>

        {/* 2. Assignment */}
        <Section section={SECTIONS[1]} open={!!open.assignment} onToggle={() => toggleSection('assignment')} errorCount={errorCountFor('assignment')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field {...f('assignment.user')} label="Assigned user" placeholder="Full name, or 'Unassigned'" />
            <Field {...f('assignment.dept')} label="Department" type="select" options={DEPARTMENTS} />
            <Field {...f('assignment.company')} label="Company" placeholder="Company name" />
            <Field {...f('assignment.location')} span="md:col-span-2" label="Physical location"
              placeholder="e.g. Level 12, Menara Cyberjaya" />
            <Field {...f('assignment.last_use')} label="Last used date" type="date"/>
          </div>
        </Section>

        {/* 3. Hardware */}
        <Section section={SECTIONS[2]} open={!!open.hardware} onToggle={() => toggleSection('hardware')} errorCount={errorCountFor('hardware')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field {...f('hardware.processor')} label="Processor" placeholder="e.g. Intel Core i7-1365U" />
            <Field {...f('hardware.ram')} label="Memory (RAM)" list="ram-options" placeholder="e.g. 16GB DDR5" />
            <Field {...f('hardware.hardisk')} label="Storage (hard disk)" list="storage-options" placeholder="e.g. 512GB NVMe SSD" />
            <Field {...f('hardware.additional_hardware')} label="Accessories and peripherals"
              placeholder="e.g. Wireless mouse, laptop bag, power adapter" />
          </div>
        </Section>

        {/* 4. Software */}
        <Section section={SECTIONS[3]} open={!!open.software} onToggle={() => toggleSection('software')} errorCount={errorCountFor('software')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field {...f('software.os.name')} label="Operating system" list="os-options" placeholder="e.g. Windows 11 Pro" />
            <Field {...f('software.os.bit')} label="OS architecture" type="select" options={ARCHITECTURES} />
            <Field {...f('software.os.product_key')} label="OS product key" type="secret" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" />

            <Field {...f('software.office.version')} span="md:col-span-2" label="Microsoft Office version"
              list="office-options" placeholder="e.g. Microsoft 365 Apps for Enterprise" />
            <Field {...f('software.office.licence_key')} label="Office licence key" type="secret" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" />

            <Field {...f('software.antivirus.name')} label="Antivirus" list="av-options" placeholder="e.g. CrowdStrike Falcon Sensor" />
            <Field {...f('software.antivirus.product_key')} label="Antivirus product key" type="secret" placeholder="Licence or tenant key" />
            <Field {...f('software.antivirus.start_date')} label="Antivirus start date" type="date" />
            <Field {...f('software.antivirus.expiry_date')} label="Antivirus expiry date" type="date"
              min={formData.software.antivirus.start_date || undefined} />
            <Field {...f('software.antivirus.last_update')} label="Antivirus last update" type="date" />
            <Field {...f('software.other_app')} label="Other installed software"
              placeholder="e.g. SAP GUI 8.0, Docker Desktop, Chrome" />
          </div>
        </Section>

        {/* 5. Procurement */}
        <Section section={SECTIONS[4]} open={!!open.procurement} onToggle={() => toggleSection('procurement')} errorCount={errorCountFor('procurement')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field {...f('procurement.supplier')} label="Supplier" list="supplier-options" placeholder="Select or type supplier" />
            <Field {...f('procurement.capex_no')} label="CAPEX number" placeholder="e.g. CAPEX-2026-014"/>
            <Field {...f('procurement.po_no')} label="Purchase order number" placeholder="e.g. PO-2026-00123" />
            <Field {...f('procurement.po_date')} label="Purchase order date" type="date" max={todayLocal()} />
            <Field {...f('procurement.invoice_no')} label="Invoice number" placeholder="e.g. INV-884213" />
            <Field {...f('procurement.amount')} label="Purchase amount" type="number" prefix="RM" min="0" step="0.01" placeholder="0.00" />
            <Field {...f('procurement.warranty')} span="md:col-span-3" label="Warranty"
              list="warranty-options" placeholder="e.g. 3 Years Onsite Support" />
          </div>
        </Section>

        {/* 6. Metadata */}
        <Section section={SECTIONS[5]} open={!!open.metadata} onToggle={() => toggleSection('metadata')} errorCount={errorCountFor('metadata')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field {...f('metadata.remark1')} label="Primary remark" placeholder="Anything worth noting" />
            <Field {...f('metadata.remark2')} label="Secondary remark" placeholder="Additional notes" />
            <Field {...f('metadata.file_seq')} label="Physical file sequence" placeholder="e.g. FILE-2026-051"/>
          </div>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 -mx-4 sm:-mx-8 -mb-4 sm:-mb-8 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-end gap-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-300 dark:border-slate-700 rounded-b-xl">
          {savedAssetId ? (
            <Link
              href={`/assets/${encodeURIComponent(savedAssetId)}/edit`}
              className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
            >
              Open saved asset
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={requestExit}
                className={`${btnBase} text-slate-800 dark:text-slate-200 border border-slate-400 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('another')}
                className={`${btnBase} text-blue-700 dark:text-blue-300 border border-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700`}
              >
                Save and add another
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${btnBase} bg-blue-600 text-white hover:bg-blue-700`}
              >
                {saving ? 'Saving asset...' : 'Save asset'}
              </button>
            </>
          )}
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 text-sm shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={toast.undo}
              className="font-bold underline cursor-pointer"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Unsaved-changes dialog */}
      {confirmExit && (
        <ConfirmDialog
          title="Discard this asset?"
          body="You have unsaved changes. If you leave now, everything you entered will be lost."
          cancelLabel="Keep editing"
          confirmLabel="Discard and leave"
          onCancel={() => setConfirmExit(false)}
          onConfirm={confirmDiscard}
        />
      )}
    </div>
  );
}