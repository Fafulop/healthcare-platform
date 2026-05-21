'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogItem {
  Value: string;
  Name: string;
}

interface FiscalFormPayload {
  patientName: string;
  doctorName: string;
  doctorSpecialty: string | null;
  existingFiscalData: {
    rfc: string | null;
    razonSocial: string | null;
    regimenFiscal: string | null;
    usoCfdi: string | null;
    codigoPostalFiscal: string | null;
  } | null;
  catalogos: {
    regimenesFiscales: CatalogItem[];
    usosCfdi: CatalogItem[];
    regimenUsoCfdiValid: Record<string, string[]>;
  };
}

type PageState = 'loading' | 'invalid' | 'already-submitted' | 'form' | 'success';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FormularioFiscalPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [payload, setPayload] = useState<FiscalFormPayload | null>(null);

  // Form fields
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('');
  const [codigoPostalFiscal, setCodigoPostalFiscal] = useState('');
  const [constanciaFile, setConstanciaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Load form on mount ────────────────────────────────────────────────────

  useEffect(() => {
    async function loadForm() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/fiscal-form?token=${token}`
        );
        const json = await res.json();

        if (!json.success) {
          if (json.alreadySubmitted) {
            setPageState('already-submitted');
          } else {
            setErrorMessage(json.error || 'Este enlace no es válido');
            setPageState('invalid');
          }
          return;
        }

        const data: FiscalFormPayload = json.data;
        setPayload(data);

        // Pre-fill if patient already has partial fiscal data
        if (data.existingFiscalData) {
          const d = data.existingFiscalData;
          if (d.rfc) setRfc(d.rfc);
          if (d.razonSocial) setRazonSocial(d.razonSocial);
          if (d.regimenFiscal) setRegimenFiscal(d.regimenFiscal);
          if (d.usoCfdi) setUsoCfdi(d.usoCfdi);
          if (d.codigoPostalFiscal) setCodigoPostalFiscal(d.codigoPostalFiscal);
        }

        setPageState('form');
      } catch {
        setErrorMessage('No se pudo cargar el formulario. Intenta de nuevo.');
        setPageState('invalid');
      }
    }

    loadForm();
  }, [token]);

  // ── Validation ──────────────────────────────────────────────────────────

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!rfc.trim()) {
      errors.rfc = 'El RFC es obligatorio';
    } else {
      const rfcClean = rfc.trim().toUpperCase();
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcClean)) {
        errors.rfc = 'El formato del RFC no es válido (ej: XAXX010101000)';
      }
    }

    if (!razonSocial.trim()) errors.razonSocial = 'La razón social es obligatoria';
    if (!regimenFiscal) errors.regimenFiscal = 'Selecciona un régimen fiscal';
    if (!usoCfdi) errors.usoCfdi = 'Selecciona un uso de CFDI';
    if (!codigoPostalFiscal.trim()) {
      errors.codigoPostalFiscal = 'El código postal fiscal es obligatorio';
    } else if (!/^\d{5}$/.test(codigoPostalFiscal.trim())) {
      errors.codigoPostalFiscal = 'El código postal debe ser de 5 dígitos';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!privacyConsent) {
      setPrivacyError('Debes aceptar el Aviso de Privacidad para enviar el formulario');
      return;
    }
    setPrivacyError('');
    setSubmitting(true);
    setSubmitError('');

    try {
      const fiscalData = {
        rfc: rfc.trim().toUpperCase(),
        razonSocial: razonSocial.trim(),
        regimenFiscal,
        usoCfdi,
        codigoPostalFiscal: codigoPostalFiscal.trim(),
      };

      let res: Response;

      if (constanciaFile) {
        // Send as FormData with file
        const formData = new FormData();
        formData.append('token', token);
        formData.append('data', JSON.stringify(fiscalData));
        formData.append('constancia', constanciaFile);

        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fiscal-form`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Send as JSON (no file)
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fiscal-form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, data: fiscalData }),
        });
      }

      const json = await res.json();

      if (json.success) {
        setPageState('success');
      } else {
        setSubmitError(json.error || 'Error al enviar los datos');
      }
    } catch {
      setSubmitError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Renders ─────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando formulario...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'already-submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Datos ya registrados</h1>
          <p className="text-gray-600">Tus datos fiscales ya fueron enviados anteriormente. ¡Gracias!</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-gray-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Datos fiscales guardados!</h1>
          <p className="text-gray-600">
            Tu médico ya puede emitir facturas a tu nombre. Estos datos se guardarán para futuras consultas.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────

  const inputClass = (field: string) =>
    `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      fieldErrors[field] ? 'border-red-400' : 'border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Datos de Facturación
            </h1>
            <p className="text-gray-500 text-sm">
              Completa tus datos fiscales para que tu médico pueda emitir tu factura (CFDI).
              Estos datos se guardarán y se reutilizarán en futuras consultas.
            </p>
          </div>

          {/* Doctor context card */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 space-y-1">
            <p className="text-sm font-medium text-gray-900">
              Dr. {payload!.doctorName}
              {payload!.doctorSpecialty && (
                <span className="font-normal text-gray-600"> — {payload!.doctorSpecialty}</span>
              )}
            </p>
            <p className="text-sm text-gray-600">Paciente: {payload!.patientName}</p>
          </div>

          {/* Info box */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-amber-800 font-medium mb-1">¿Cómo obtener tus datos fiscales?</p>
            <p className="text-xs text-amber-700">
              Puedes encontrar toda la información en tu <strong>Constancia de Situación Fiscal</strong>,
              que puedes descargar desde el portal del SAT (sat.gob.mx). También puedes subir el PDF
              de tu constancia al final de este formulario como referencia.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* RFC */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                RFC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={rfc}
                onChange={(e) => {
                  setRfc(e.target.value.toUpperCase());
                  if (fieldErrors.rfc) setFieldErrors((p) => { const n = { ...p }; delete n.rfc; return n; });
                }}
                placeholder="XAXX010101000"
                maxLength={13}
                className={inputClass('rfc')}
              />
              <p className="text-xs text-gray-500">13 caracteres para persona física, 12 para persona moral</p>
              {fieldErrors.rfc && <p className="text-xs text-red-500">{fieldErrors.rfc}</p>}
            </div>

            {/* Razon Social */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={razonSocial}
                onChange={(e) => {
                  setRazonSocial(e.target.value);
                  if (fieldErrors.razonSocial) setFieldErrors((p) => { const n = { ...p }; delete n.razonSocial; return n; });
                }}
                placeholder="Nombre completo tal como aparece en tu Constancia de Situación Fiscal"
                className={inputClass('razonSocial')}
              />
              {fieldErrors.razonSocial && <p className="text-xs text-red-500">{fieldErrors.razonSocial}</p>}
            </div>

            {/* Regimen Fiscal */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Régimen Fiscal <span className="text-red-500">*</span>
              </label>
              <select
                value={regimenFiscal}
                onChange={(e) => {
                  const newRegimen = e.target.value;
                  setRegimenFiscal(newRegimen);
                  // Reset uso CFDI if current selection is not valid for the new régimen
                  if (newRegimen && usoCfdi) {
                    const valid = payload!.catalogos.regimenUsoCfdiValid[newRegimen];
                    if (valid && !valid.includes(usoCfdi)) setUsoCfdi('');
                  }
                  if (fieldErrors.regimenFiscal) setFieldErrors((p) => { const n = { ...p }; delete n.regimenFiscal; return n; });
                }}
                className={inputClass('regimenFiscal')}
              >
                <option value="">Selecciona tu régimen fiscal</option>
                {payload!.catalogos.regimenesFiscales.map((r) => (
                  <option key={r.Value} value={r.Value}>
                    {r.Value} - {r.Name}
                  </option>
                ))}
              </select>
              {fieldErrors.regimenFiscal && <p className="text-xs text-red-500">{fieldErrors.regimenFiscal}</p>}
            </div>

            {/* Uso CFDI */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Uso del CFDI <span className="text-red-500">*</span>
              </label>
              <select
                value={usoCfdi}
                onChange={(e) => {
                  setUsoCfdi(e.target.value);
                  if (fieldErrors.usoCfdi) setFieldErrors((p) => { const n = { ...p }; delete n.usoCfdi; return n; });
                }}
                className={inputClass('usoCfdi')}
              >
                <option value="">Selecciona el uso del CFDI</option>
                {payload!.catalogos.usosCfdi
                  .filter((u) => {
                    if (!regimenFiscal) return true; // show all if no régimen selected yet
                    const valid = payload!.catalogos.regimenUsoCfdiValid[regimenFiscal];
                    return !valid || valid.includes(u.Value);
                  })
                  .map((u) => (
                  <option key={u.Value} value={u.Value}>
                    {u.Value} - {u.Name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                {!regimenFiscal
                  ? 'Selecciona primero tu régimen fiscal para ver las opciones disponibles'
                  : 'Solo se muestran los usos de CFDI válidos para tu régimen fiscal'}
              </p>
              {fieldErrors.usoCfdi && <p className="text-xs text-red-500">{fieldErrors.usoCfdi}</p>}
            </div>

            {/* Codigo Postal Fiscal */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Código Postal del domicilio fiscal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={codigoPostalFiscal}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setCodigoPostalFiscal(val);
                  if (fieldErrors.codigoPostalFiscal) setFieldErrors((p) => { const n = { ...p }; delete n.codigoPostalFiscal; return n; });
                }}
                placeholder="00000"
                maxLength={5}
                inputMode="numeric"
                className={inputClass('codigoPostalFiscal')}
              />
              {fieldErrors.codigoPostalFiscal && <p className="text-xs text-red-500">{fieldErrors.codigoPostalFiscal}</p>}
            </div>

            {/* Constancia de Situación Fiscal (optional file) */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Constancia de Situación Fiscal (opcional)
              </label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                {constanciaFile ? (
                  <div className="space-y-1">
                    <svg className="w-8 h-8 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-900">{constanciaFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(constanciaFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConstanciaFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Quitar archivo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">Haz click para subir tu Constancia de Situación Fiscal</p>
                    <p className="text-xs text-gray-500">PDF, máximo 16 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 16 * 1024 * 1024) {
                    setSubmitError('El archivo no puede ser mayor a 16 MB');
                    return;
                  }
                  setConstanciaFile(file);
                }}
              />
              <p className="text-xs text-gray-500">
                Puedes descargar tu constancia desde <strong>sat.gob.mx</strong> → Otros trámites y servicios →
                Genera tu Constancia de Situación Fiscal.
              </p>
            </div>

            {/* Privacy consent */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-600 mb-2 font-medium">Consentimiento de tratamiento de datos personales</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => { setPrivacyConsent(e.target.checked); setPrivacyError(''); }}
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 rounded"
                />
                <span className="text-xs text-gray-600 leading-snug">
                  He leído y acepto el{' '}
                  <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                    Aviso de Privacidad
                  </a>
                  . Consiento expresamente el tratamiento de mis datos fiscales para la emisión de
                  comprobantes fiscales digitales (CFDI) por parte de mi médico. *
                </span>
              </label>
              {privacyError && (
                <p className="text-xs text-red-600 mt-2">{privacyError}</p>
              )}
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !privacyConsent}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Guardando datos fiscales...' : 'Guardar datos fiscales'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
