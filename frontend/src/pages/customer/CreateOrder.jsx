import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  Ruler,
  Scissors,
  Send,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import {
  DEFAULT_MEASUREMENTS,
  FABRIC_SUGGESTIONS,
  GARMENT_TYPES,
  MEASUREMENT_UNIT_HINT,
  slugifyLabel,
} from '../../utils/tailoring';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50';
const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700';

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 10;

const SECTIONS = [
  { title: 'Basic details', description: 'Garment, fabric & delivery preference' },
  { title: 'Style & measurements', description: 'Fit numbers and custom styling' },
  { title: 'Reference images', description: 'Photos that capture the look you want' },
  { title: 'Instructions & terms', description: 'Final notes and agreement' },
];

function toDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fieldError(errors, field) {
  const value = errors[field];
  return Array.isArray(value) ? value[0] : value;
}

function Field({ label, required = false, hint, error, children }) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  // Step 1 — basic details
  const [garmentType, setGarmentType] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [otherGarment, setOtherGarment] = useState('');

  // Step 2 — style & measurements
  const [measurements, setMeasurements] = useState(() =>
    DEFAULT_MEASUREMENTS.map(({ key, label }) => ({ id: `default-${key}`, key, label, custom: false, value: '' })),
  );
  const [customCount, setCustomCount] = useState(0);
  const [styleDetails, setStyleDetails] = useState('');

  // Step 3 — reference images (each entry keeps its own object URL for cleanup)
  const [files, setFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const fileInputRef = useRef(null);
  const filesRef = useRef([]);

  // Step 4 — instructions & agreement
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // ------------------------------------------------------------------ images

  const addFiles = useCallback((incoming) => {
    const next = Array.from(incoming ?? []);
    const warnings = [];
    const accepted = [];

    for (const file of next) {
      if (!file.type.startsWith('image/')) {
        warnings.push(`"${file.name}" is not an image and was skipped.`);
        continue;
      }
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        warnings.push(`"${file.name}" is larger than ${MAX_IMAGE_MB}MB and was skipped.`);
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    setFiles((current) => {
      const combined = [...current, ...accepted];
      const excess = Math.max(0, combined.length - MAX_IMAGES);
      if (excess > 0) {
        combined.slice(-excess).forEach((entry) => URL.revokeObjectURL(entry.url));
        warnings.push(
          `Only ${MAX_IMAGES} reference images are allowed — ${excess} file${excess > 1 ? 's' : ''} not added.`,
        );
        return combined.slice(0, MAX_IMAGES);
      }
      return combined;
    });
    setFileErrors((current) => [...current, ...warnings]);
  }, []);

  // Keep a live reference to current entries so the unmount cleanup always
  // revokes every object URL (a mount-time closure would capture an empty list).
  useEffect(() => {
    filesRef.current = files;
  });

  useEffect(() => {
    const entries = filesRef.current;
    return () => entries.forEach((entry) => URL.revokeObjectURL(entry.url));
  }, []);

  const removeFile = (entryId) => {
    setFiles((current) => {
      const removed = current.find((entry) => entry.id === entryId);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((entry) => entry.id !== entryId);
    });
  };

  const dismissFileError = (index) => {
    setFileErrors((current) => current.filter((_, i) => i !== index));
  };

  // ----------------------------------------------------------- measurements

  const updateMeasurement = (id, value) => {
    setMeasurements((current) =>
      current.map((row) => (row.id === id ? { ...row, value } : row)),
    );
  };

  const addCustomMeasurement = () => {
    setCustomCount((count) => count + 1);
    setMeasurements((current) => [
      ...current,
      { id: `custom-${Date.now()}`, key: '', label: '', custom: true, value: '' },
    ]);
  };

  const updateCustom = (id, patch) => {
    setMeasurements((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeCustom = (id) => {
    setMeasurements((current) => current.filter((row) => row.id !== id));
  };

  const customSlugs = useMemo(() => {
    const slugs = new Set(DEFAULT_MEASUREMENTS.map(({ key }) => key));
    const used = [];
    measurements.forEach((row) => {
      if (row.custom && row.label.trim()) {
        used.push({ id: row.id, slug: slugifyLabel(row.label) });
      }
    });
    const seen = new Set();
    const duplicates = [];
    for (const entry of used) {
      if (slugs.has(entry.slug) || seen.has(entry.slug)) {
        duplicates.push(entry.id);
      }
      seen.add(entry.slug);
    }
    return duplicates;
  }, [measurements]);

  const measurementObject = useMemo(() => {
    const out = {};
    measurements.forEach((row) => {
      const value = row.value.trim();
      if (!value) return;
      const key = row.custom ? slugifyLabel(row.label) : row.key;
      if (key) out[key] = value;
    });
    return out;
  }, [measurements]);

  // --------------------------------------------------------------- validation

  const validateStep = (target) => {
    const next = {};
    if (target === 0) {
      const type = garmentType === 'Other' ? otherGarment.trim() : garmentType.trim();
      if (!type) {
        next.garmentType = garmentType === 'Other' ? 'Please name the garment' : 'Please choose a garment type';
      }
      if (!preferredDeliveryDate) {
        next.preferredDeliveryDate = 'Please pick your preferred delivery date';
      } else if (preferredDeliveryDate < toDateInputValue()) {
        next.preferredDeliveryDate = 'Delivery date cannot be in the past';
      }
    }
    if (target === 1) {
      if (customSlugs.length > 0) {
        next.customMeasurements =
          'Custom measurement names must be unique and cannot match the standard ones.';
      }
      const badRows = measurements.filter((row) => row.value.trim() && !/^\d+(\.\d+)?$/.test(row.value.trim()));
      if (badRows.length > 0) {
        next.measurementValues = 'Measurements must be whole numbers or decimals (e.g. 40 or 40.5).';
      }
    }
    if (target === 2) {
      // Images are optional; nothing to gate here.
    }
    if (target === 3) {
      if (!agreed) {
        next.agreed = 'Please accept the terms to continue.';
      }
    }
    return next;
  };

  const goNext = () => {
    const nextErrors = validateStep(step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setStep((current) => Math.min(current + 1, SECTIONS.length - 1));
    }
  };

  const goBack = () => setStep((current) => Math.max(current - 1, 0));

  // ------------------------------------------------------------------ submit

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateStep(3);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setServerError('');
    try {
      const formData = new FormData();
      const resolvedGarment = garmentType === 'Other' ? otherGarment.trim() : garmentType.trim();
      formData.append('garmentType', resolvedGarment);
      if (fabricType.trim()) formData.append('fabricType', fabricType.trim());
      if (preferredDeliveryDate) formData.append('preferredDeliveryDate', preferredDeliveryDate);
      if (styleDetails.trim()) formData.append('styleDetails', styleDetails.trim());
      if (Object.keys(measurementObject).length > 0) {
        formData.append('measurements', JSON.stringify(measurementObject));
      }
      if (specialInstructions.trim()) {
        formData.append('specialInstructions', specialInstructions.trim());
      }
      files.forEach(({ file }) => formData.append('referenceImages', file));

      await api.post('/orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Request submitted. A tailor will review it and send you an estimate.');
      navigate('/customer/dashboard', { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors && typeof data.errors === 'object') {
        setErrors(data.errors);
        setServerError(data.message || 'Please fix the highlighted fields and try again.');
      } else {
        setServerError(data?.message || 'Could not submit the request. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeGarment = garmentType === 'Other' ? otherGarment : garmentType;
  const garmentName = activeGarment.trim() || 'your garment';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/customer/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my orders
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">New tailoring request</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tell us exactly what you want stitched — every detail helps the tailor get the fit right the
          first time.
        </p>
      </div>

      {/* Stepper */}
      <ol className="mb-6 grid grid-cols-4 gap-2">
        {SECTIONS.map((section, index) => {
          const active = index === step;
          const done = index < step;
          return (
            <li key={section.title} className="flex flex-col">
              <button
                type="button"
                onClick={() => index < step && setStep(index)}
                disabled={index > step}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-gray-800 bg-gray-800 text-white shadow'
                    : done
                      ? 'cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                      : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-white text-gray-800' : done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight">
                    {section.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Active step hint */}
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
        {SECTIONS[step].description}
      </p>

      {serverError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{serverError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {/* --------------------------------------------------- Section 1 */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Garment type"
                required
                error={fieldError(errors, 'garmentType')}
              >
                <select
                  className={inputClass}
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                >
                  <option value="">Choose a garment…</option>
                  {GARMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Fabric type" hint="Optional — leave blank and we will confirm fabric later.">
                <input
                  className={inputClass}
                  list="fabric-suggestions"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="e.g. Washed cotton, silk, velvet"
                />
                <datalist id="fabric-suggestions">
                  {FABRIC_SUGGESTIONS.map((fabric) => (
                    <option key={fabric} value={fabric} />
                  ))}
                </datalist>
              </Field>
            </div>

            {garmentType === 'Other' && (
              <Field label="Tell us the garment" required error={fieldError(errors, 'garmentType')}>
                <input
                  className={inputClass}
                  value={otherGarment}
                  onChange={(e) => setOtherGarment(e.target.value)}
                  placeholder="e.g. Traditional Balochi dress"
                />
              </Field>
            )}

            <Field
              label="Preferred delivery date"
              required
              hint="We aim for this date — the tailor may propose a slightly different one with your estimate."
              error={fieldError(errors, 'preferredDeliveryDate')}
            >
              <input
                type="date"
                className={inputClass}
                min={toDateInputValue()}
                value={preferredDeliveryDate}
                onChange={(e) => setPreferredDeliveryDate(e.target.value)}
              />
            </Field>
          </div>
        )}

        {/* --------------------------------------------------- Section 2 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-800">Standard measurements</h2>
                </div>
                <span className="text-xs text-gray-400">{MEASUREMENT_UNIT_HINT}</span>
              </div>
              <p className="mb-3 text-sm text-gray-500">
                Only fill the ones you know. Everything is in inches; you can skip any that don&apos;t
                apply to {garmentName}.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {measurements
                  .filter((row) => !row.custom)
                  .map((row) => (
                    <label key={row.id} className="block">
                      <span className="mb-1 block text-xs font-medium text-gray-500">{row.label}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={inputClass}
                        value={row.value}
                        onChange={(e) => updateMeasurement(row.id, e.target.value)}
                        placeholder="—"
                      />
                    </label>
                  ))}
              </div>
              {fieldError(errors, 'measurementValues') && (
                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {fieldError(errors, 'measurementValues')}
                </p>
              )}
            </div>

            {measurements.filter((row) => row.custom).length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-gray-700">Custom measurements</h3>
                <div className="space-y-3">
                  {measurements
                    .filter((row) => row.custom)
                    .map((row) => (
                      <div key={row.id} className="flex items-center gap-3">
                        <input
                          className={`${inputClass} flex-1`}
                          value={row.label}
                          onChange={(e) => updateCustom(row.id, { label: e.target.value, key: slugifyLabel(e.target.value) })}
                          placeholder="Measurement name, e.g. Pant width"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          className={`${inputClass} w-32`}
                          value={row.value}
                          onChange={(e) => updateCustom(row.id, { value: e.target.value })}
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustom(row.id)}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                          aria-label="Remove measurement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {fieldError(errors, 'customMeasurements') && (
              <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {fieldError(errors, 'customMeasurements')}
              </p>
            )}

            <button
              type="button"
              onClick={addCustomMeasurement}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-500 hover:text-gray-800"
            >
              <Plus className="h-4 w-4" />
              Add custom measurement
            </button>

            <Field label="Style details" hint="Stitching style, collar type, embroidery, buttons, lining, pockets…">
              <textarea
                rows={4}
                className={inputClass}
                value={styleDetails}
                onChange={(e) => setStyleDetails(e.target.value)}
                placeholder={`Describe how you want ${garmentName} finished. Example: single-breasted, band collar, full sleeves, gold thread embroidery on the collar and cuffs.`}
              />
            </Field>
          </div>
        )}

        {/* --------------------------------------------------- Section 3 */}
        {step === 2 && (
          <div className="space-y-5">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center transition hover:border-gray-500 hover:bg-gray-100"
            >
              <UploadCloud className="mb-3 h-10 w-10 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700">Drag & drop reference images here</p>
              <p className="mt-1 text-sm text-gray-400">
                or click to browse — up to {MAX_IMAGES} images, {MAX_IMAGE_MB}MB each
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-sm text-gray-500">
                Reference photos are shared only with the tailor handling your order.
              </p>
              {fileErrors.length > 0 && (
                <div className="mb-3 space-y-1">
                  {fileErrors.map((message, index) => (
                    <div
                      key={`${message}-${index}`}
                      className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                    >
                      <span className="flex items-start gap-1.5">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {message}
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissFileError(index)}
                        className="rounded p-0.5 text-amber-500 transition hover:text-amber-700"
                        aria-label="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {files.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
                  <ImagePlus className="h-4 w-4" />
                  No images added yet — this step is optional but recommended.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {files.map(({ id, file, url }) => (
                    <div key={id} className="group relative overflow-hidden rounded-xl border border-gray-200">
                      <img src={url} alt={file.name} className="h-32 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(id)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <p className="truncate bg-gray-900/80 px-2 py-1 text-[11px] text-white">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------- Section 4 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Scissors className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-800">Special instructions</h2>
              </div>
              <p className="mb-3 text-sm text-gray-500">
                Fittings, alterations, urgencies or anything else the tailor should know.
              </p>
              <textarea
                rows={4}
                className={inputClass}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. I can visit the shop for a fitting on Saturdays. Please make the sleeves slightly loose."
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">What happens next</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>An admin reviews your request and assigns it to a tailor.</li>
                <li>The tailor sends an estimated price and a completion date for your approval.</li>
                <li>You confirm and pay once an invoice is issued — stitching starts after payment.</li>
                <li>
                  Your preferred delivery date is <b>{preferredDeliveryDate ? new Date(`${preferredDeliveryDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'as requested'}</b>.
                  The tailor&apos;s estimate may propose a different date, which you can approve or discuss.
                </li>
              </ul>
            </div>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                agreed ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-800 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-600">
                I confirm the details I&apos;ve provided are accurate, and I agree to be contacted about
                this request. I understand the final price and completion date will be confirmed by the
                tailor before any work begins. <span className="text-red-500">*</span>
              </span>
            </label>
            {fieldError(errors, 'agreed') && (
              <p className="flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {fieldError(errors, 'agreed')}
              </p>
            )}

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Reference images</span>
                <span className="font-medium text-gray-700">{files.length}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-gray-500">Measurements provided</span>
                <span className="font-medium text-gray-700">
                  {Object.keys(measurementObject).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- Nav buttons */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {step < SECTIONS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-gray-900"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-gray-900 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit request
                </>
              )}
            </button>
          )}
        </div>
      </form>

      {/* Step-complete reassurance on last step */}
      {step === 3 && Object.keys(measurementObject).length === 0 && files.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <CheckCircle2 className="h-4 w-4 text-gray-300" />
          Tip: adding measurements or reference images helps the tailor give an accurate estimate.
        </p>
      )}
    </div>
  );
}
