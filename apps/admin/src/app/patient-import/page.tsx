"use client";

/**
 * Migración asistida de pacientes — FASE 3.
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/
 *
 * El doctor manda su tabla, alguien de aquí la modela a la plantilla y la sube
 * por él. Dos pasos SIEMPRE: validar y ver qué va a entrar, y hasta entonces
 * confirmar. Nunca hay un botón que escriba directo.
 *
 * El mismo archivo se manda dos veces (a /validate y a /commit) a propósito.
 * El commit VUELVE a parsear y validar; no acepta renglones ya procesados del
 * cliente, porque si lo hiciera se podría escribir en el expediente saltándose
 * la validación entera. Efecto secundario bueno: no hay que guardar el archivo
 * en ningún lado entre un paso y el otro.
 */

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

interface Doctor {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
}

interface Issue {
  sheet: string;
  row: number;
  column?: string;
  level: "error" | "warning";
  code: string;
  message: string;
}

interface Preview {
  doctor: { id: string; doctorFullName: string; slug: string; city: string } | null;
  sourceFile: string;
  counts: { patientsOk: number; encountersOk: number; errors: number; warnings: number };
  issues: Issue[];
  preview: {
    patients: { row: number; internalId: string | null; nombre: string }[];
    encounters: { row: number; patientRef: string; fecha: string; motivo: string }[];
  };
}

interface CommitResult {
  batchId: string;
  patientsCreated: number;
  encountersCreated: number;
  auditRowsWritten: number;
  skipped: number;
  warnings: number;
}

export default function PatientImportPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState<null | "validate" | "commit" | "template">(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * La plantilla NO puede ser un `<a href>`: el endpoint exige
   * `Authorization: Bearer` y una navegación a otro origen no lo manda, así que
   * se bajaría un archivo con el JSON del 401 dentro.
   */
  async function downloadTemplate() {
    setBusy("template");
    setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/patient-import/template`, {
        method: "GET",
      });
      if (!res.ok) throw new Error("No se pudo descargar la plantilla.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-pacientes-tusalud.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    fetch(`${API_URL}/api/doctors`)
      .then((r) => r.json())
      .then((j) => setDoctors(j.data ?? j ?? []))
      .catch(() => setError("No se pudo cargar la lista de doctores."));
  }, []);

  // Cualquier cambio invalida la vista previa. Sin esto se podría confirmar
  // una previa hecha con OTRO archivo o para OTRO doctor.
  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
  };

  async function send(step: "validate" | "commit") {
    if (!file || !doctorId) return;
    setBusy(step);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("doctorId", doctorId);

      const res = await authFetch(`${API_URL}/api/patient-import/${step}`, {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");

      if (step === "validate") setPreview(json.data);
      else setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(null);
    }
  }

  const errors = preview?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.level === "warning") ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">Migración de pacientes</h1>
      <p className="mt-1 text-sm text-gray-600">
        Sube la plantilla llena y se importa al expediente del doctor que elijas.
      </p>

      <button
        onClick={downloadTemplate}
        disabled={busy !== null}
        className="mt-4 inline-block text-sm font-medium text-indigo-600 underline disabled:opacity-40"
      >
        {busy === "template" ? "Preparando…" : "Descargar la plantilla .xlsx"}
      </button>

      {/* ── Paso 1 ── */}
      <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <label className="block text-sm font-semibold">Doctor destino</label>
          <select
            value={doctorId}
            onChange={(e) => {
              setDoctorId(e.target.value);
              reset();
            }}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="">— Elige un doctor —</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.doctorFullName} ({d.slug})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold">Archivo</label>
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              reset();
            }}
            className="mt-1 block w-full text-sm"
          />
        </div>

        <button
          onClick={() => send("validate")}
          disabled={!file || !doctorId || busy !== null}
          className="rounded bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          {busy === "validate" ? "Revisando…" : "Revisar archivo"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* ── Paso 2: vista previa ── */}
      {preview && !result && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          {/* El nombre del doctor va GRANDE. Importarle a quien no era es una
              fuga de datos entre doctores, no un typo — y un id no se revisa. */}
          <div className="rounded border-2 border-amber-400 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">Se va a escribir en el expediente de:</p>
            <p className="text-xl font-bold text-amber-950">
              {preview.doctor?.doctorFullName ?? "(doctor desconocido)"}
            </p>
            <p className="text-sm text-amber-900">
              {preview.doctor?.slug} · {preview.doctor?.city}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3 text-center">
            {[
              ["Pacientes", preview.counts.patientsOk, "text-green-700"],
              ["Consultas", preview.counts.encountersOk, "text-green-700"],
              ["Con error", preview.counts.errors, "text-red-700"],
              ["Avisos", preview.counts.warnings, "text-amber-700"],
            ].map(([label, n, color]) => (
              <div key={String(label)} className="rounded border border-gray-200 p-3">
                <p className={`text-2xl font-bold ${color}`}>{n as number}</p>
                <p className="text-xs text-gray-600">{label as string}</p>
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <IssueTable
              title={`${errors.length} renglones NO se van a importar`}
              tone="error"
              issues={errors}
            />
          )}
          {warnings.length > 0 && (
            <IssueTable
              title={`${warnings.length} avisos — sí se importan, pero revísalos`}
              tone="warning"
              issues={warnings}
            />
          )}

          <button
            onClick={() => send("commit")}
            disabled={busy !== null || preview.counts.patientsOk === 0}
            className="mt-5 rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy === "commit"
              ? "Importando…"
              : `Importar ${preview.counts.patientsOk} pacientes a ${preview.doctor?.doctorFullName ?? ""}`}
          </button>
        </div>
      )}

      {/* ── Paso 3: resultado ── */}
      {result && (
        <div className="mt-6 rounded-lg border-2 border-green-400 bg-green-50 p-5">
          <h2 className="text-lg font-bold text-green-900">Importación terminada</h2>
          <ul className="mt-2 space-y-1 text-sm text-green-900">
            <li>{result.patientsCreated} pacientes creados</li>
            <li>{result.encountersCreated} consultas creadas</li>
            <li>{result.auditRowsWritten} registros de auditoría</li>
            {result.skipped > 0 && (
              <li className="font-semibold">
                {result.skipped} renglones se omitieron por errores — corrígelos y vuelve a
                subir solo esos.
              </li>
            )}
          </ul>
          <p className="mt-3 font-mono text-xs text-green-800">lote: {result.batchId}</p>
        </div>
      )}
    </div>
  );
}

function IssueTable({
  title,
  tone,
  issues,
}: {
  title: string;
  tone: "error" | "warning";
  issues: Issue[];
}) {
  const color = tone === "error" ? "text-red-800" : "text-amber-800";
  return (
    <div className="mt-5">
      <h3 className={`text-sm font-bold ${color}`}>{title}</h3>
      <div className="mt-2 max-h-72 overflow-auto rounded border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-100">
            <tr>
              <th className="px-2 py-1">Hoja</th>
              <th className="px-2 py-1">Fila</th>
              <th className="px-2 py-1">Columna</th>
              <th className="px-2 py-1">Qué pasa</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i, n) => (
              <tr key={n} className="border-t border-gray-100">
                <td className="px-2 py-1 whitespace-nowrap">{i.sheet}</td>
                <td className="px-2 py-1 font-mono">{i.row}</td>
                <td className="px-2 py-1 whitespace-nowrap">{i.column ?? "—"}</td>
                <td className="px-2 py-1">{i.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
