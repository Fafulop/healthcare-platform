'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Users, Loader2, FileText, List, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { PatientCard, type Patient } from '@/components/medical-records/PatientCard';
import { PatientRow, PatientRowHeader } from '@/components/medical-records/PatientRow';
import { PatientSearchBar } from '@/components/medical-records/PatientSearchBar';

const VIEW_STORAGE_KEY = 'medicalRecordsViewMode';

export default function PatientsPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const initialFetchDone = useRef(false);
  // Rows are the default; the doctor can switch to cards. Same persistence
  // pattern as sidebarCollapsed / widgetsCollapsed.
  const [viewMode, setViewMode] = useState<'rows' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'cards' ? 'cards' : 'rows';
    }
    return 'rows';
  });

  const changeViewMode = (next: 'rows' | 'cards') => {
    setViewMode(next);
    localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const fetchPatients = useCallback(async (searchValue: string, statusValue: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: statusValue, ...(searchValue && { search: searchValue }) });
      const res = await fetch(`/api/medical-records/patients?${params}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error fetching patients');
      }
      const data = await res.json();
      if (!data?.data || !Array.isArray(data.data)) throw new Error('Invalid response format');
      setPatients(data.data);
    } catch (err: any) {
      setError(err.message || 'Error loading patients');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + statusFilter changes (immediate)
  useEffect(() => {
    if (status !== 'authenticated') return;
    initialFetchDone.current = true;
    fetchPatients(search, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, status]);

  // Debounced search — skips initial mount (statusFilter effect handles that)
  useEffect(() => {
    if (status !== 'authenticated') return;
    // On mount, initialFetchDone is false until the statusFilter effect runs first;
    // skip this effect on that first render to avoid double-fetch.
    if (!initialFetchDone.current) return;
    const timer = setTimeout(() => fetchPatients(search, statusFilter), search ? 350 : 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expedientes Médicos</h1>
            <p className="text-gray-600 mt-1 text-sm">Gestiona los expedientes de tus pacientes</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
<Link
              href="/dashboard/medical-records/custom-templates"
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Plantillas</span>
            </Link>
            <Link
              href="/dashboard/medical-records/patients/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo Paciente
            </Link>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <PatientSearchBar
        search={search}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
      />

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Count + view toggle. Not gated on `loading`: a search refetch keeps the
          previous results in `patients`, so gating here would make the toggle
          blink out of existence on every debounced keystroke. */}
      {patients.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          {!loading && (
            <p className="text-sm text-gray-500">
              {patients.length} paciente{patients.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="flex gap-1 flex-shrink-0 ml-auto">
            <button
              onClick={() => changeViewMode('rows')}
              aria-pressed={viewMode === 'rows'}
              aria-label="Ver como filas"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'rows'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Filas</span>
            </button>
            <button
              onClick={() => changeViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              aria-label="Ver como tarjetas"
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
          </div>
        </div>
      )}

      {/* Patient list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : patients.length > 0 ? (
        viewMode === 'cards' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => (
              <PatientCard key={patient.id} patient={patient} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <PatientRowHeader />
            {patients.map((patient) => (
              <PatientRow key={patient.id} patient={patient} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No se encontraron pacientes</p>
          <p className="text-gray-400 text-sm mb-4">
            {search ? `Sin resultados para "${search}"` : 'Comienza agregando tu primer paciente'}
          </p>
          {!search && (
            <Link
              href="/dashboard/medical-records/patients/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuevo Paciente
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
