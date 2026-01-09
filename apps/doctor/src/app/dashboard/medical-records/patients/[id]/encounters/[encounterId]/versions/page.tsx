'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clock, User } from 'lucide-react';
import Link from 'next/link';

interface Version {
  id: number;
  versionNumber: number;
  encounterData: any;
  createdBy: string;
  changeReason?: string;
  createdAt: string;
}

export default function EncounterVersionsPage() {
  const params = useParams();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [patientId, encounterId]);

  const fetchVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/medical-records/patients/${patientId}/encounters/${encounterId}/versions`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar versiones');
      }

      const data = await res.json();
      setVersions(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading versions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando historial de versiones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Link
            href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
            className="text-red-600 hover:text-red-800 mt-2 inline-block"
          >
            Volver a la consulta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a la Consulta
        </Link>
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Versiones</h1>
            <p className="text-gray-600 mt-1">
              Revise los cambios realizados a esta consulta a lo largo del tiempo
            </p>
          </div>
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No hay versiones anteriores</p>
          <p className="text-gray-400 text-sm">
            Las versiones se crean automáticamente cuando se edita una consulta
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Versions list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Versiones ({versions.length})</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedVersion?.id === version.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          Versión {version.versionNumber}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formatDate(version.createdAt)}
                        </div>
                        {version.changeReason && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {version.changeReason}
                          </div>
                        )}
                      </div>
                      {selectedVersion?.id === version.id && (
                        <div className="ml-2 w-2 h-2 rounded-full bg-blue-600"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Version details */}
          <div className="lg:col-span-2">
            {selectedVersion ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Versión {selectedVersion.versionNumber}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(selectedVersion.createdAt)}
                    </div>
                    {selectedVersion.changeReason && (
                      <div className="flex-1">
                        <span className="font-medium">Razón:</span> {selectedVersion.changeReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Encounter data snapshot */}
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Información Básica</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Fecha:</span>
                        <span className="ml-2 font-medium">
                          {new Date(selectedVersion.encounterData.encounterDate).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tipo:</span>
                        <span className="ml-2 font-medium">{selectedVersion.encounterData.encounterType}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Motivo:</span>
                        <span className="ml-2 font-medium">{selectedVersion.encounterData.chiefComplaint}</span>
                      </div>
                    </div>
                  </div>

                  {/* SOAP Notes */}
                  {(selectedVersion.encounterData.subjective || selectedVersion.encounterData.objective ||
                    selectedVersion.encounterData.assessment || selectedVersion.encounterData.plan) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas SOAP</h3>
                      <div className="space-y-3">
                        {selectedVersion.encounterData.subjective && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Subjetivo (S)</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedVersion.encounterData.subjective}
                            </div>
                          </div>
                        )}
                        {selectedVersion.encounterData.objective && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Objetivo (O)</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedVersion.encounterData.objective}
                            </div>
                          </div>
                        )}
                        {selectedVersion.encounterData.assessment && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Evaluación (A)</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedVersion.encounterData.assessment}
                            </div>
                          </div>
                        )}
                        {selectedVersion.encounterData.plan && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-1">Plan (P)</div>
                            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {selectedVersion.encounterData.plan}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Clinical Notes (if no SOAP) */}
                  {selectedVersion.encounterData.clinicalNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Notas Clínicas</h3>
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                        {selectedVersion.encounterData.clinicalNotes}
                      </div>
                    </div>
                  )}

                  {/* Vitals */}
                  {(selectedVersion.encounterData.vitalsBloodPressure || selectedVersion.encounterData.vitalsHeartRate ||
                    selectedVersion.encounterData.vitalsTemperature) && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Signos Vitales</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        {selectedVersion.encounterData.vitalsBloodPressure && (
                          <div>
                            <span className="text-gray-600">Presión Arterial:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsBloodPressure}</span>
                          </div>
                        )}
                        {selectedVersion.encounterData.vitalsHeartRate && (
                          <div>
                            <span className="text-gray-600">FC:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsHeartRate} lpm</span>
                          </div>
                        )}
                        {selectedVersion.encounterData.vitalsTemperature && (
                          <div>
                            <span className="text-gray-600">Temperatura:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsTemperature}°C</span>
                          </div>
                        )}
                        {selectedVersion.encounterData.vitalsWeight && (
                          <div>
                            <span className="text-gray-600">Peso:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsWeight} kg</span>
                          </div>
                        )}
                        {selectedVersion.encounterData.vitalsHeight && (
                          <div>
                            <span className="text-gray-600">Altura:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsHeight} cm</span>
                          </div>
                        )}
                        {selectedVersion.encounterData.vitalsOxygenSat && (
                          <div>
                            <span className="text-gray-600">SpO2:</span>
                            <span className="ml-2 font-medium">{selectedVersion.encounterData.vitalsOxygenSat}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">Seleccione una versión para ver los detalles</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
