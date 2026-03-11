'use client';

import { useState } from 'react';
import { FileText, Activity, Image as ImageIcon, Video, Mic, Pill, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface TimelineEncounter {
  id: string;
  encounterDate: string;
  encounterType: string;
  chiefComplaint: string;
  status: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  clinicalNotes?: string;
  vitalsBloodPressure?: string;
  vitalsHeartRate?: number;
  vitalsTemperature?: number;
  vitalsWeight?: number;
  vitalsHeight?: number;
  vitalsOxygenSat?: number;
  vitalsOther?: string;
  location?: string;
  followUpDate?: string;
  followUpNotes?: string;
  templateId?: string | null;
  customData?: Record<string, any> | null;
}

interface CustomTemplateField {
  name: string;
  label: string;
  labelEs?: string;
}

interface TimelineMedia {
  id: string;
  mediaType: 'image' | 'video' | 'audio';
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  category?: string | null;
  bodyArea?: string | null;
  captureDate: string;
  description?: string | null;
  doctorNotes?: string | null;
  encounterId?: string | null;
}

interface TimelinePrescription {
  id: string;
  prescriptionDate: string;
  status: string;
  diagnosis?: string | null;
  medications: Array<{ id: number; drugName: string }>;
  createdAt: string;
}

interface FullPrescriptionData {
  doctorFullName: string;
  doctorLicense: string;
  diagnosis?: string | null;
  clinicalNotes?: string | null;
  expiresAt?: string | null;
  issuedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  medications: Array<{
    id: number;
    drugName: string;
    presentation?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    duration?: string | null;
    quantity?: number | null;
    instructions?: string | null;
    warnings?: string | null;
  }>;
}

interface TimelineItem {
  type: 'encounter' | 'media' | 'prescription';
  date: string;
  data: TimelineEncounter | TimelineMedia | TimelinePrescription;
}

interface TimelineViewProps {
  timeline: TimelineItem[];
  patientId: string;
}

export function TimelineView({ timeline, patientId }: TimelineViewProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [fullPrescriptions, setFullPrescriptions] = useState<Record<string, FullPrescriptionData>>({});
  const [loadingPrescriptions, setLoadingPrescriptions] = useState<Set<string>>(new Set());
  const [customTemplates, setCustomTemplates] = useState<Record<string, CustomTemplateField[]>>({});
  const [loadingTemplates, setLoadingTemplates] = useState<Set<string>>(new Set());

  const isExpanded = (id: string) => expandedItems.has(id);

  const fetchTemplate = async (templateId: string) => {
    if (customTemplates[templateId] || loadingTemplates.has(templateId)) return;
    setLoadingTemplates(prev => new Set(prev).add(templateId));
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.customFields) {
          setCustomTemplates(prev => ({ ...prev, [templateId]: data.data.customFields }));
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoadingTemplates(prev => { const s = new Set(prev); s.delete(templateId); return s; });
    }
  };

  const toggleExpand = async (id: string, type: 'encounter' | 'prescription', templateId?: string | null) => {
    const next = new Set(expandedItems);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (type === 'prescription' && !fullPrescriptions[id]) {
        setLoadingPrescriptions(prev => new Set(prev).add(id));
        try {
          const res = await fetch(`/api/medical-records/patients/${patientId}/prescriptions/${id}`);
          const data = await res.json();
          setFullPrescriptions(prev => ({ ...prev, [id]: data.data }));
        } catch {
          // silently fail — user can still open full page
        } finally {
          setLoadingPrescriptions(prev => {
            const s = new Set(prev);
            s.delete(id);
            return s;
          });
        }
      }
      if (type === 'encounter' && templateId) {
        fetchTemplate(templateId);
      }
    }
    setExpandedItems(next);
  };

  const formatDate = (dateString: string): string => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  const encounterStatusColor = (s: string) =>
    ({ completed: 'bg-green-100 text-green-800 border-green-200', draft: 'bg-yellow-100 text-yellow-800 border-yellow-200', amended: 'bg-blue-100 text-blue-800 border-blue-200' }[s] ?? 'bg-gray-100 text-gray-800 border-gray-200');

  const encounterStatusLabel = (s: string) =>
    ({ completed: 'Completada', draft: 'Borrador', amended: 'Enmendada' }[s] ?? s);

  const encounterTypeLabel = (t: string) =>
    ({ consultation: 'Consulta', 'follow-up': 'Seguimiento', emergency: 'Emergencia', telemedicine: 'Telemedicina' }[t] ?? t);

  const rxStatusColor = (s: string) =>
    ({ draft: 'bg-yellow-100 text-yellow-800 border-yellow-200', issued: 'bg-green-100 text-green-800 border-green-200', cancelled: 'bg-red-100 text-red-800 border-red-200', expired: 'bg-gray-100 text-gray-800 border-gray-200' }[s] ?? 'bg-gray-100 text-gray-800 border-gray-200');

  const rxStatusLabel = (s: string) =>
    ({ draft: 'Borrador', issued: 'Emitida', cancelled: 'Cancelada', expired: 'Expirada' }[s] ?? s);

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg mb-2">No hay registros en el historial</p>
        <p className="text-gray-400 text-sm">Las consultas y prescripciones aparecerán aquí una vez creadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {timeline.map((item, index) => {
        const isLast = index === timeline.length - 1;

        // ── ENCOUNTER ────────────────────────────────────────────────────
        if (item.type === 'encounter') {
          const enc = item.data as TimelineEncounter;
          const expanded = isExpanded(enc.id);
          const hasVitals = !!(enc.vitalsBloodPressure || enc.vitalsHeartRate || enc.vitalsTemperature || enc.vitalsWeight || enc.vitalsHeight || enc.vitalsOxygenSat || enc.vitalsOther);
          const hasCustomData = !!(enc.customData && Object.keys(enc.customData).length > 0);
          const templateFields = enc.templateId ? customTemplates[enc.templateId] : null;
          const hasSOAP = !!(enc.subjective || enc.objective || enc.assessment || enc.plan);

          // Derive best title and preview for this encounter
          const isCustom = !!(enc.templateId || enc.customData);
          let cardTitle: string;
          let cardPreview: string | null = null;
          if (isCustom && enc.customData) {
            const vals = Object.values(enc.customData).filter(v => typeof v === 'string' && (v as string).trim());
            cardTitle = (vals[0] as string) || encounterTypeLabel(enc.encounterType);
            cardPreview = vals[1] ? String(vals[1]).slice(0, 120) : null;
          } else {
            cardTitle = enc.chiefComplaint || enc.assessment || encounterTypeLabel(enc.encounterType);
            cardPreview = enc.assessment && enc.assessment !== cardTitle
              ? enc.assessment.slice(0, 120)
              : enc.clinicalNotes?.slice(0, 120) || null;
          }
          // Indicator chips for collapsed view
          const chips: string[] = [];
          if (hasSOAP) chips.push('SOAP');
          if (hasVitals) chips.push('Signos Vitales');
          if (hasCustomData) chips.push('Plantilla personalizada');
          if (enc.followUpDate || enc.followUpNotes) chips.push('Seguimiento');

          return (
            <div key={enc.id} className="relative">
              {!isLast && <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200 -mb-8" />}
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow" />

              <div className="ml-14">
                <div className="bg-white rounded-lg shadow border border-gray-200">
                  {/* Header — click to expand */}
                  <button
                    onClick={() => toggleExpand(enc.id, 'encounter', hasCustomData ? enc.templateId : null)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          <h3 className="text-base font-semibold text-gray-900 truncate">{cardTitle}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>{formatDate(enc.encounterDate.split('T')[0])}</span>
                          <span>•</span>
                          <span>{encounterTypeLabel(enc.encounterType)}</span>
                          {enc.location && <><span>•</span><span>{enc.location}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${encounterStatusColor(enc.status)}`}>
                          {encounterStatusLabel(enc.status)}
                        </span>
                        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded body */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4">
                      {/* Vitals */}
                      {hasVitals && (
                        <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-semibold text-blue-900">Signos Vitales</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {enc.vitalsBloodPressure && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Presión Arterial</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsBloodPressure}</p>
                              </div>
                            )}
                            {enc.vitalsHeartRate && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Frec. Cardíaca</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsHeartRate} lpm</p>
                              </div>
                            )}
                            {enc.vitalsTemperature && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Temperatura</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsTemperature}°C</p>
                              </div>
                            )}
                            {enc.vitalsWeight && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Peso</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsWeight} kg</p>
                              </div>
                            )}
                            {enc.vitalsHeight && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Talla</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsHeight} cm</p>
                              </div>
                            )}
                            {enc.vitalsOxygenSat && (
                              <div className="bg-white rounded p-2">
                                <p className="text-xs text-gray-500">Sat. O₂</p>
                                <p className="font-semibold text-gray-900">{enc.vitalsOxygenSat}%</p>
                              </div>
                            )}
                          </div>
                          {enc.vitalsOther && (
                            <p className="mt-2 pt-2 border-t border-blue-100 text-sm text-gray-700">
                              <span className="font-medium">Otros:</span> {enc.vitalsOther}
                            </p>
                          )}
                        </div>
                      )}

                      {/* SOAP notes */}
                      {hasSOAP && (
                        <div className="space-y-3">
                          {enc.subjective && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex-shrink-0">S</span>
                                <span className="text-sm font-semibold text-gray-700">Subjetivo</span>
                              </div>
                              <p className="text-sm text-gray-700 ml-8 whitespace-pre-wrap">{enc.subjective}</p>
                            </div>
                          )}
                          {enc.objective && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs flex-shrink-0">O</span>
                                <span className="text-sm font-semibold text-gray-700">Objetivo</span>
                              </div>
                              <p className="text-sm text-gray-700 ml-8 whitespace-pre-wrap">{enc.objective}</p>
                            </div>
                          )}
                          {enc.assessment && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 font-bold text-xs flex-shrink-0">A</span>
                                <span className="text-sm font-semibold text-gray-700">Evaluación</span>
                              </div>
                              <p className="text-sm text-gray-700 ml-8 whitespace-pre-wrap">{enc.assessment}</p>
                            </div>
                          )}
                          {enc.plan && (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex-shrink-0">P</span>
                                <span className="text-sm font-semibold text-gray-700">Plan</span>
                              </div>
                              <p className="text-sm text-gray-700 ml-8 whitespace-pre-wrap">{enc.plan}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Clinical notes (only if no SOAP) */}
                      {enc.clinicalNotes && !hasSOAP && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas Clínicas</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{enc.clinicalNotes}</p>
                        </div>
                      )}

                      {/* Custom template data */}
                      {hasCustomData && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            {enc.templateId && loadingTemplates.has(enc.templateId)
                              ? 'Cargando campos...'
                              : 'Datos de la Consulta'}
                          </p>
                          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {templateFields
                              ? templateFields.map((field) => {
                                  const value = enc.customData![field.name];
                                  if (value === undefined || value === null || value === '') return null;
                                  return (
                                    <div key={field.name}>
                                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                                        {field.labelEs || field.label || field.name}
                                      </dt>
                                      <dd className="text-sm text-gray-900 whitespace-pre-wrap">
                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                      </dd>
                                    </div>
                                  );
                                })
                              : Object.entries(enc.customData!).map(([key, value]) => {
                                  if (value === undefined || value === null || value === '') return null;
                                  return (
                                    <div key={key}>
                                      <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{key}</dt>
                                      <dd className="text-sm text-gray-900 whitespace-pre-wrap">
                                        {Array.isArray(value) ? value.join(', ') : String(value)}
                                      </dd>
                                    </div>
                                  );
                                })}
                          </dl>
                        </div>
                      )}

                      {/* Follow-up */}
                      {(enc.followUpDate || enc.followUpNotes) && (
                        <div className="pt-2 border-t border-gray-100 bg-blue-50 rounded-md p-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center justify-between">
                            Seguimiento
                            {enc.followUpDate && (
                              <span className="font-normal text-blue-700 text-sm">
                                {formatDate(enc.followUpDate.split('T')[0])}
                              </span>
                            )}
                          </p>
                          {enc.followUpNotes && (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{enc.followUpNotes}</p>
                          )}
                        </div>
                      )}

                      {/* Link to full page */}
                      <div className="pt-2 border-t border-gray-100 flex justify-end">
                        <Link
                          href={`/dashboard/medical-records/patients/${patientId}/encounters/${enc.id}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Abrir consulta completa
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Collapsed preview */}
                  {!expanded && (
                    <div className="px-4 py-2.5 bg-gray-50 rounded-b-lg border-t border-gray-100 space-y-1.5">
                      {cardPreview && (
                        <p className="text-xs text-gray-600 line-clamp-2">{cardPreview}{cardPreview.length >= 120 ? '…' : ''}</p>
                      )}
                      {chips.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {chips.map(chip => (
                            <span key={chip} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded border border-blue-100">{chip}</span>
                          ))}
                        </div>
                      ) : (
                        !cardPreview && <span className="text-xs text-gray-400">Clic para ver detalles</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // ── PRESCRIPTION ─────────────────────────────────────────────────
        if (item.type === 'prescription') {
          const rx = item.data as TimelinePrescription;
          const expanded = isExpanded(rx.id);
          const fullData = fullPrescriptions[rx.id];
          const loading = loadingPrescriptions.has(rx.id);

          return (
            <div key={rx.id} className="relative">
              {!isLast && <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200 -mb-8" />}
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow" />

              <div className="ml-14">
                <div className="bg-white rounded-lg shadow border border-gray-200">
                  {/* Header — click to expand */}
                  <button
                    onClick={() => toggleExpand(rx.id, 'prescription')}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Pill className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {rx.diagnosis || 'Prescripción Médica'}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>{formatDate(rx.prescriptionDate.split('T')[0])}</span>
                          <span>•</span>
                          <span>{rx.medications.length} medicamento{rx.medications.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${rxStatusColor(rx.status)}`}>
                          {rxStatusLabel(rx.status)}
                        </span>
                        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded body */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4">
                      {loading && (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                      )}

                      {!loading && fullData && (
                        <>
                          {/* Doctor */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Doctor</p>
                              <p className="text-sm font-medium text-gray-900">{fullData.doctorFullName}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Cédula</p>
                              <p className="text-sm font-medium text-gray-900">{fullData.doctorLicense}</p>
                            </div>
                          </div>

                          {/* Diagnosis */}
                          {fullData.diagnosis && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Diagnóstico</p>
                              <p className="text-sm text-gray-700">{fullData.diagnosis}</p>
                            </div>
                          )}

                          {/* Clinical notes */}
                          {fullData.clinicalNotes && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notas Clínicas</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{fullData.clinicalNotes}</p>
                            </div>
                          )}

                          {/* Medications */}
                          {fullData.medications.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Medicamentos</p>
                              <div className="space-y-2">
                                {fullData.medications.map((med, i) => (
                                  <div key={med.id} className="p-3 bg-emerald-50 rounded-md border border-emerald-100">
                                    <div className="flex items-start gap-2">
                                      <span className="text-xs font-bold text-emerald-600 mt-0.5 w-5 flex-shrink-0">{i + 1}.</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">
                                          {med.drugName}
                                          {med.presentation && (
                                            <span className="font-normal text-gray-600"> — {med.presentation}</span>
                                          )}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
                                          {med.dosage && <span><span className="font-medium">Dosis:</span> {med.dosage}</span>}
                                          {med.frequency && <span><span className="font-medium">Frecuencia:</span> {med.frequency}</span>}
                                          {med.duration && <span><span className="font-medium">Duración:</span> {med.duration}</span>}
                                          {med.quantity != null && <span><span className="font-medium">Cantidad:</span> {med.quantity}</span>}
                                        </div>
                                        {med.instructions && (
                                          <p className="mt-1 text-xs text-gray-500">{med.instructions}</p>
                                        )}
                                        {med.warnings && (
                                          <p className="mt-1 text-xs text-amber-600 font-medium">{med.warnings}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Cancellation reason */}
                          {fullData.cancellationReason && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                              <p className="text-xs font-semibold text-red-700 mb-1">Motivo de Cancelación</p>
                              <p className="text-sm text-red-600">{fullData.cancellationReason}</p>
                            </div>
                          )}

                          {/* Link to full page */}
                          <div className="pt-2 border-t border-gray-100 flex justify-end">
                            <Link
                              href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${rx.id}`}
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Abrir prescripción completa
                            </Link>
                          </div>
                        </>
                      )}

                      {/* Fallback if fetch failed */}
                      {!loading && !fullData && (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500 mb-2">No se pudo cargar el detalle.</p>
                          <Link
                            href={`/dashboard/medical-records/patients/${patientId}/prescriptions/${rx.id}`}
                            className="text-sm text-emerald-600 hover:text-emerald-800"
                          >
                            Abrir prescripción completa →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Collapsed — show drug chips */}
                  {!expanded && (
                    <div className="px-4 py-2 bg-gray-50 rounded-b-lg border-t border-gray-100">
                      <div className="flex flex-wrap gap-1.5">
                        {rx.medications.slice(0, 5).map(m => (
                          <span key={m.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-100">
                            {m.drugName}
                          </span>
                        ))}
                        {rx.medications.length > 5 && (
                          <span className="text-xs text-gray-400 self-center">+{rx.medications.length - 5} más</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // ── MEDIA ────────────────────────────────────────────────────────
        if (item.type === 'media') {
          const media = item.data as TimelineMedia;
          const MediaIcon = media.mediaType === 'image' ? ImageIcon : media.mediaType === 'video' ? Video : Mic;

          return (
            <div key={media.id} className="relative">
              {!isLast && <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200 -mb-8" />}
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-purple-500 border-4 border-white shadow" />

              <div className="ml-14">
                <Link href={`/dashboard/medical-records/patients/${patientId}/media`}>
                  <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 cursor-pointer">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <MediaIcon className="w-5 h-5 text-purple-600 flex-shrink-0" />
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {media.description || media.fileName}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                            <span>{formatDate(media.captureDate)}</span>
                            <span>•</span>
                            <span className="capitalize">{media.mediaType}</span>
                            {media.category && <><span>•</span><span className="capitalize">{media.category}</span></>}
                          </div>
                        </div>
                        {media.bodyArea && (
                          <span className="ml-3 px-2.5 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-gray-800 border-gray-200 flex-shrink-0">
                            {media.bodyArea}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 flex gap-4">
                      <div className="flex-shrink-0">
                        {media.mediaType === 'image' && (
                          <img src={media.fileUrl} alt={media.description || media.fileName} className="w-32 h-32 object-cover rounded-md" />
                        )}
                        {media.mediaType === 'video' && (
                          <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center relative">
                            {media.thumbnailUrl
                              ? <img src={media.thumbnailUrl} alt={media.description || media.fileName} className="w-full h-full object-cover rounded-md" />
                              : <Video className="w-12 h-12 text-gray-400" />
                            }
                            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-md">
                              <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-gray-800 border-b-[6px] border-b-transparent ml-1" />
                              </div>
                            </div>
                          </div>
                        )}
                        {media.mediaType === 'audio' && (
                          <div className="w-32 h-32 bg-purple-50 rounded-md flex items-center justify-center">
                            <Mic className="w-12 h-12 text-purple-500" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {media.doctorNotes
                          ? <p className="text-sm text-gray-700 line-clamp-3">{media.doctorNotes}</p>
                          : media.description
                          ? <p className="text-sm text-gray-700 line-clamp-3">{media.description}</p>
                          : <p className="text-sm text-gray-400 italic">Sin descripción</p>
                        }
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                      <span className="text-xs text-purple-600 font-medium">Ver documentos y galería →</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
