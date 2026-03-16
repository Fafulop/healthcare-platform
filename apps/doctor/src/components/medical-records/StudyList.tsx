'use client';

import { Plus, X, GripVertical } from 'lucide-react';

export interface ImagingStudy {
  id?: number;
  studyName: string;
  region?: string;
  indication?: string;
  urgency?: string;
  notes?: string;
  order?: number;
}

export interface LabStudy {
  id?: number;
  studyName: string;
  indication?: string;
  urgency?: string;
  fasting?: string;
  notes?: string;
  order?: number;
}

// ─── Imaging Studies ──────────────────────────────────────────────────────────

interface ImagingStudyListProps {
  studies: ImagingStudy[];
  onChange: (studies: ImagingStudy[]) => void;
  readOnly?: boolean;
}

export function ImagingStudyList({ studies, onChange, readOnly = false }: ImagingStudyListProps) {
  const add = () => {
    onChange([...studies, { studyName: '', order: studies.length }]);
  };

  const remove = (index: number) => {
    onChange(studies.filter((_, i) => i !== index));
  };

  const update = (index: number, field: keyof ImagingStudy, value: string) => {
    onChange(studies.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  if (readOnly && studies.length === 0) {
    return <p className="text-sm text-gray-500 py-2">No hay estudios de imagen en esta prescripción</p>;
  }

  return (
    <div className="space-y-4">
      {studies.map((study, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-start gap-3">
            {!readOnly && (
              <div className="flex-shrink-0 pt-2">
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estudio *</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.studyName}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.studyName}
                      onChange={(e) => update(index, 'studyName', e.target.value)}
                      placeholder="Ej: Radiografía de tórax, TAC de abdomen"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Región</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.region || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.region || ''}
                      onChange={(e) => update(index, 'region', e.target.value)}
                      placeholder="Ej: Tórax, Abdomen, Columna lumbar"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indicación</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.indication || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.indication || ''}
                      onChange={(e) => update(index, 'indication', e.target.value)}
                      placeholder="Ej: Descartar neumonía"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgencia</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.urgency || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.urgency || ''}
                      onChange={(e) => update(index, 'urgency', e.target.value)}
                      placeholder="Ej: Urgente, Rutina, Electivo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                {readOnly ? (
                  study.notes ? <p className="text-gray-900">{study.notes}</p> : <p className="text-gray-500">-</p>
                ) : (
                  <textarea
                    value={study.notes || ''}
                    onChange={(e) => update(index, 'notes', e.target.value)}
                    placeholder="Instrucciones adicionales para el estudio"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar estudio"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Agregar Estudio de Imagen
        </button>
      )}
    </div>
  );
}

// ─── Lab Studies ──────────────────────────────────────────────────────────────

interface LabStudyListProps {
  studies: LabStudy[];
  onChange: (studies: LabStudy[]) => void;
  readOnly?: boolean;
}

export function LabStudyList({ studies, onChange, readOnly = false }: LabStudyListProps) {
  const add = () => {
    onChange([...studies, { studyName: '', order: studies.length }]);
  };

  const remove = (index: number) => {
    onChange(studies.filter((_, i) => i !== index));
  };

  const update = (index: number, field: keyof LabStudy, value: string) => {
    onChange(studies.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  if (readOnly && studies.length === 0) {
    return <p className="text-sm text-gray-500 py-2">No hay estudios de laboratorio en esta prescripción</p>;
  }

  return (
    <div className="space-y-4">
      {studies.map((study, index) => (
        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-start gap-3">
            {!readOnly && (
              <div className="flex-shrink-0 pt-2">
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estudio *</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.studyName}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.studyName}
                      onChange={(e) => update(index, 'studyName', e.target.value)}
                      placeholder="Ej: Biometría hemática, Química sanguínea"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgencia</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.urgency || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.urgency || ''}
                      onChange={(e) => update(index, 'urgency', e.target.value)}
                      placeholder="Ej: Urgente, Rutina"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indicación</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.indication || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.indication || ''}
                      onChange={(e) => update(index, 'indication', e.target.value)}
                      placeholder="Ej: Control de diabetes"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ayuno</label>
                  {readOnly ? (
                    <p className="text-gray-900">{study.fasting || '-'}</p>
                  ) : (
                    <input
                      type="text"
                      value={study.fasting || ''}
                      onChange={(e) => update(index, 'fasting', e.target.value)}
                      placeholder="Ej: Ayuno de 8 horas, No requiere ayuno"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                {readOnly ? (
                  study.notes ? <p className="text-gray-900">{study.notes}</p> : <p className="text-gray-500">-</p>
                ) : (
                  <textarea
                    value={study.notes || ''}
                    onChange={(e) => update(index, 'notes', e.target.value)}
                    placeholder="Instrucciones adicionales para el estudio"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
            {!readOnly && (
              <div className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar estudio"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Agregar Estudio de Laboratorio
        </button>
      )}
    </div>
  );
}
