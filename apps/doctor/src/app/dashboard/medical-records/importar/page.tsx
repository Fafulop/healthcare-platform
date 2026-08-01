'use client';

/**
 * Importar pacientes desde la plantilla — FASE 4 (autoservicio).
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/
 *
 * Es la misma máquina que usa admin en `apps/admin/src/app/patient-import/`,
 * contra las mismas rutas de `apps/api`. Cambian dos cosas y solo dos:
 *   1. Aquí NO se elige doctor — el servidor lo saca de la sesión. Mandar un
 *      `doctorId` distinto al propio corta con 403.
 *   2. Se esconde a las cuentas de apoyo.
 *
 * Los dos pasos son obligatorios: revisar y luego confirmar. Nunca hay un botón
 * que escriba directo.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { usePermissions } from '@/lib/permissions-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Issue {
  sheet: string;
  row: number;
  column?: string;
  level: 'error' | 'warning';
  code: string;
  message: string;
}

interface Preview {
  sourceFile: string;
  counts: { patientsOk: number; encountersOk: number; errors: number; warnings: number };
  issues: Issue[];
}

interface CommitResult {
  batchId: string;
  patientsCreated: number;
  encountersCreated: number;
  skipped: number;
}

export default function ImportarPacientesPage() {
  const { isOwner, loading } = usePermissions();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState<null | 'validate' | 'commit' | 'template'>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * La plantilla NO puede ser un `<a href>`.
   *
   * `GET /api/patient-import/template` exige `Authorization: Bearer`, y una
   * navegación del navegador a OTRO origen no manda ese header (ni cookies).
   * El doctor se bajaría un archivo con `{"error":"Missing or invalid
   * authorization header"}` dentro. Hay que pedirla autenticada y disparar la
   * descarga desde el blob.
   */
  async function downloadTemplate() {
    setBusy('template');
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/patient-import/template`, {
        method: 'GET',
      });
      if (!res.ok) throw new Error('No se pudo descargar la plantilla.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-pacientes-tusalud.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // Cargar de golpe la base entera de pacientes es del titular. La API lo
  // rechaza igual (OWNER_ONLY + comprobación en la ruta); esto solo evita
  // enseñar una pantalla que terminaría en 403.
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">
          Solo el titular de la cuenta puede importar pacientes.
        </p>
      </div>
    );
  }

  async function send(step: 'validate' | 'commit') {
    if (!file) return;
    setBusy(step);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);

      const res = await authFetch(`${API_URL}/api/patient-import/${step}`, {
        method: 'POST',
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');

      if (step === 'validate') setPreview(json.data);
      else setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
    }
  }

  const errors = preview?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = preview?.issues.filter((i) => i.level === 'warning') ?? [];

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link
        href="/dashboard/medical-records"
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Volver a Pacientes
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">Importar pacientes</h1>
      <p className="mt-1 text-gray-600">
        Trae tus pacientes y su historial desde otro sistema, o desde tu propia hoja de
        cálculo.
      </p>

      {/* Paso 1 */}
      <ol className="mt-6 space-y-4">
        <li className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900">1. Descarga la plantilla</p>
          <p className="mt-1 text-sm text-gray-600">
            Trae las columnas ya puestas y una hoja de instrucciones. Llénala sin cambiarle el
            nombre a las hojas.
          </p>
          <button
            onClick={downloadTemplate}
            disabled={busy !== null}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Download className="h-5 w-5" />
            {busy === 'template' ? 'Preparando…' : 'Descargar plantilla'}
          </button>
        </li>

        <li className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900">2. Súbela y revisa</p>
          <p className="mt-1 text-sm text-gray-600">
            Todavía no se guarda nada. Primero te enseñamos qué va a entrar y qué renglones
            tienen problemas.
          </p>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
              setError(null);
            }}
            className="mt-3 block w-full text-sm"
          />
          <button
            onClick={() => send('validate')}
            disabled={!file || busy !== null}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-40"
          >
            {busy === 'validate' ? 'Revisando…' : 'Revisar archivo'}
          </button>
        </li>
      </ol>

      {error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Paso 3 — vista previa */}
      {preview && !result && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-900">3. Confirma</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ['Pacientes', preview.counts.patientsOk, 'text-green-700'],
              ['Consultas', preview.counts.encountersOk, 'text-green-700'],
              ['Con error', preview.counts.errors, 'text-red-700'],
              ['Avisos', preview.counts.warnings, 'text-amber-700'],
            ] as const).map(([label, n, color]) => (
              <div key={label} className="rounded-lg border border-gray-200 p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{n}</p>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <IssueList
              icon="error"
              title={`${errors.length} renglones NO se van a importar`}
              issues={errors}
            />
          )}
          {warnings.length > 0 && (
            <IssueList
              icon="warning"
              title={`${warnings.length} avisos — sí entran, pero revísalos`}
              issues={warnings}
            />
          )}

          <button
            onClick={() => send('commit')}
            disabled={busy !== null || preview.counts.patientsOk === 0}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-40"
          >
            {busy === 'commit'
              ? 'Importando…'
              : `Importar ${preview.counts.patientsOk} pacientes`}
          </button>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-6 rounded-lg border-2 border-green-400 bg-green-50 p-5">
          <p className="flex items-center gap-2 text-lg font-bold text-green-900">
            <CheckCircle2 className="h-6 w-6" />
            Listo
          </p>
          <ul className="mt-2 space-y-1 text-sm text-green-900">
            <li>{result.patientsCreated} pacientes agregados a tu expediente</li>
            <li>{result.encountersCreated} consultas de su historial</li>
            {result.skipped > 0 && (
              <li className="font-semibold">
                {result.skipped} renglones se omitieron por errores. Corrígelos en tu archivo y
                sube solo esos — los que ya entraron no se duplican.
              </li>
            )}
          </ul>
          <Link
            href="/dashboard/medical-records"
            className="mt-4 inline-block font-semibold text-green-900 underline"
          >
            Ver mis pacientes
          </Link>
        </div>
      )}
    </div>
  );
}

function IssueList({
  icon,
  title,
  issues,
}: {
  icon: 'error' | 'warning';
  title: string;
  issues: Issue[];
}) {
  const tone =
    icon === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
  const text = icon === 'error' ? 'text-red-800' : 'text-amber-800';

  return (
    <div className={`mt-4 rounded-lg border ${tone} p-3`}>
      <p className={`flex items-center gap-2 text-sm font-bold ${text}`}>
        <AlertTriangle className="h-4 w-4" />
        {title}
      </p>
      <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs text-gray-800">
        {issues.map((i, n) => (
          <li key={n}>
            {/* La hoja y el renglón van primero: es lo que el doctor necesita
                para ir a arreglarlo en su archivo. */}
            <span className="font-mono font-semibold">
              {i.sheet} fila {i.row}
              {i.column ? ` · ${i.column}` : ''}
            </span>{' '}
            — {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
