"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@healthcare/database";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

interface Doctor {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
}

interface MemberRow {
  id: string;
  doctorId: string;
  memberEmail: string;
  memberName: string | null;
  memberImage: string | null;
  permissions: Partial<Record<PermissionKey, boolean>>;
  invitedByEmail: string | null;
  createdAt: string;
}

interface PendingRow {
  id: string;
  doctorId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

function permsSummary(perms: Partial<Record<PermissionKey, boolean>>): { count: number; labels: string[] } {
  const on = PERMISSION_KEYS.filter((k) => perms?.[k] === true);
  return { count: on.length, labels: on.map((k) => PERMISSION_LABELS[k]) };
}

export default function HelpersPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [docRes, helperRes] = await Promise.all([
          fetch(`${API_URL}/api/doctors`),
          authFetch(`${API_URL}/api/admin/doctor-members`),
        ]);
        const docJson = await docRes.json();
        const helperJson = await helperRes.json();
        if (docJson.success) setDoctors(docJson.data);
        if (helperJson.success) {
          setMembers(helperJson.data.members);
          setPending(helperJson.data.pending);
        } else {
          setError(helperJson.message || "No se pudieron cargar los asistentes");
        }
      } catch (err) {
        console.error(err);
        setError("Error de conexión con el servidor");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const memberByDoctor = new Map(members.map((m) => [m.doctorId, m]));
  const pendingByDoctor = new Map(pending.map((p) => [p.doctorId, p]));

  const withHelper = doctors.filter((d) => memberByDoctor.has(d.id) || pendingByDoctor.has(d.id));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-4">
          <Link href="/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver al Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Asistentes (helpers)</h1>
          <p className="text-gray-600">
            {loading
              ? "Cargando..."
              : `${withHelper.length} de ${doctors.length} doctores tienen un asistente o invitación pendiente`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Los asistentes son usuarios secundarios (tabla doctor_members). No aparecen en la página de
            Usuarios porque no usan el vínculo legacy de doctor. Límite: un asistente activo por doctor.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Cargando...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asistente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permisos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desde</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {doctors.map((d) => {
                    const m = memberByDoctor.get(d.id);
                    const p = pendingByDoctor.get(d.id);
                    const summary = m ? permsSummary(m.permissions) : null;
                    return (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{d.doctorFullName}</div>
                          <div className="text-xs text-gray-500">{d.primarySpecialty}</div>
                        </td>
                        <td className="px-6 py-4">
                          {m ? (
                            <div className="flex items-center gap-3">
                              {m.memberImage && (
                                <img src={m.memberImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{m.memberName || m.memberEmail}</div>
                                <div className="text-xs text-gray-500">{m.memberEmail}</div>
                              </div>
                            </div>
                          ) : p ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              Invitado (pendiente): {p.email}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Sin asistente</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {summary ? (
                            <span
                              className="text-sm text-gray-700"
                              title={summary.labels.join(", ")}
                            >
                              {summary.count} de {PERMISSION_KEYS.length}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {m ? new Date(m.createdAt).toLocaleDateString("es-MX") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
