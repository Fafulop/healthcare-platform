'use client';

import { FileText, Activity, Image as ImageIcon, Video, Mic } from 'lucide-react';
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
  location?: string;
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

interface TimelineItem {
  type: 'encounter' | 'media';
  date: string;
  data: TimelineEncounter | TimelineMedia;
}

interface TimelineViewProps {
  timeline: TimelineItem[];
  patientId: string;
}

export function TimelineView({ timeline, patientId }: TimelineViewProps) {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      completed: 'bg-green-100 text-green-800 border-green-200',
      draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      amended: 'bg-blue-100 text-blue-800 border-blue-200'
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      completed: 'Completada',
      draft: 'Borrador',
      amended: 'Enmendada'
    };
    return statusMap[status] || status;
  };

  const getEncounterTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      consultation: 'Consulta',
      'follow-up': 'Seguimiento',
      emergency: 'Emergencia',
      telemedicine: 'Telemedicina'
    };
    return typeMap[type] || type;
  };

  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg mb-2">No hay consultas en el historial</p>
        <p className="text-gray-400 text-sm">Las consultas aparecerán aquí una vez creadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {timeline.map((item, index) => {
        // Render encounter items
        if (item.type === 'encounter') {
          const encounter = item.data as TimelineEncounter;
          const hasSOAPNotes = !!(encounter.subjective || encounter.objective || encounter.assessment || encounter.plan);
          const hasVitals = !!(encounter.vitalsBloodPressure || encounter.vitalsHeartRate || encounter.vitalsTemperature);

          return (
            <div key={encounter.id} className="relative">
            {/* Timeline connector line */}
            {index !== timeline.length - 1 && (
              <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200 -mb-8"></div>
            )}

            {/* Timeline dot */}
            <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow"></div>

            {/* Timeline card */}
            <div className="ml-14">
              <Link href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounter.id}`}>
                <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 cursor-pointer">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {encounter.chiefComplaint}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span>{formatDate(encounter.encounterDate)}</span>
                          <span>•</span>
                          <span>{getEncounterTypeLabel(encounter.encounterType)}</span>
                          {encounter.location && (
                            <>
                              <span>•</span>
                              <span>{encounter.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(encounter.status)}`}>
                        {getStatusLabel(encounter.status)}
                      </span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <div className="p-4">
                    {/* Vitals preview */}
                    {hasVitals && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Signos Vitales</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {encounter.vitalsBloodPressure && (
                            <div>
                              <span className="text-gray-600">PA:</span>
                              <span className="ml-1 font-medium">{encounter.vitalsBloodPressure}</span>
                            </div>
                          )}
                          {encounter.vitalsHeartRate && (
                            <div>
                              <span className="text-gray-600">FC:</span>
                              <span className="ml-1 font-medium">{encounter.vitalsHeartRate} lpm</span>
                            </div>
                          )}
                          {encounter.vitalsTemperature && (
                            <div>
                              <span className="text-gray-600">Temp:</span>
                              <span className="ml-1 font-medium">{encounter.vitalsTemperature}°C</span>
                            </div>
                          )}
                          {encounter.vitalsWeight && (
                            <div>
                              <span className="text-gray-600">Peso:</span>
                              <span className="ml-1 font-medium">{encounter.vitalsWeight} kg</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SOAP notes preview */}
                    {hasSOAPNotes ? (
                      <div className="space-y-2">
                        {encounter.subjective && (
                          <div className="text-sm">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs mr-2">S</span>
                            <span className="text-gray-700 line-clamp-2">{encounter.subjective}</span>
                          </div>
                        )}
                        {encounter.assessment && (
                          <div className="text-sm">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 font-semibold text-xs mr-2">A</span>
                            <span className="text-gray-700 line-clamp-2">{encounter.assessment}</span>
                          </div>
                        )}
                        {encounter.plan && (
                          <div className="text-sm">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs mr-2">P</span>
                            <span className="text-gray-700 line-clamp-2">{encounter.plan}</span>
                          </div>
                        )}
                      </div>
                    ) : encounter.clinicalNotes ? (
                      <div className="text-sm text-gray-700 line-clamp-3">
                        {encounter.clinicalNotes}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 italic">
                        Sin notas clínicas registradas
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                    <span className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Ver detalles completos →
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          </div>
          );
        }

        // Render media items
        if (item.type === 'media') {
          const media = item.data as TimelineMedia;
          const MediaIconComponent = media.mediaType === 'image' ? ImageIcon :
                                      media.mediaType === 'video' ? Video :
                                      Mic;

          return (
            <div key={media.id} className="relative">
              {/* Timeline connector line */}
              {index !== timeline.length - 1 && (
                <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gray-200 -mb-8"></div>
              )}

              {/* Timeline dot */}
              <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-purple-500 border-4 border-white shadow"></div>

              {/* Timeline card */}
              <div className="ml-14">
                <Link href={`/dashboard/medical-records/patients/${patientId}/media`}>
                  <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 cursor-pointer">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MediaIconComponent className="w-5 h-5 text-purple-600" />
                            <h3 className="text-lg font-semibold text-gray-900">
                              {media.description || media.fileName}
                            </h3>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span>{formatDate(media.captureDate)}</span>
                            <span>•</span>
                            <span className="capitalize">{media.mediaType}</span>
                            {media.category && (
                              <>
                                <span>•</span>
                                <span className="capitalize">{media.category}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {media.bodyArea && (
                          <span className="px-3 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-800 border-gray-200">
                            {media.bodyArea}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Media Preview */}
                    <div className="p-4">
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0">
                          {media.mediaType === 'image' && (
                            <img
                              src={media.fileUrl}
                              alt={media.description || media.fileName}
                              className="w-32 h-32 object-cover rounded-md"
                            />
                          )}
                          {media.mediaType === 'video' && (
                            <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center relative">
                              {media.thumbnailUrl ? (
                                <img
                                  src={media.thumbnailUrl}
                                  alt={media.description || media.fileName}
                                  className="w-full h-full object-cover rounded-md"
                                />
                              ) : (
                                <Video className="w-12 h-12 text-gray-400" />
                              )}
                              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-md">
                                <div className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
                                  <div className="w-0 h-0 border-t-6 border-t-transparent border-l-8 border-l-gray-800 border-b-6 border-b-transparent ml-1"></div>
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

                        {/* Description */}
                        <div className="flex-1 min-w-0">
                          {media.doctorNotes ? (
                            <p className="text-sm text-gray-700 line-clamp-3">{media.doctorNotes}</p>
                          ) : media.description ? (
                            <p className="text-sm text-gray-700 line-clamp-3">{media.description}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">Sin descripción</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                      <span className="text-xs text-purple-600 hover:text-purple-800 font-medium">
                        Ver galería completa →
                      </span>
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
