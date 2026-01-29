'use client';

export interface SOAPNoteData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface SOAPFieldVisibility {
  subjective?: boolean;
  objective?: boolean;
  assessment?: boolean;
  plan?: boolean;
}

interface SOAPNoteEditorProps {
  soapNotes: SOAPNoteData;
  onChange: (soapNotes: SOAPNoteData) => void;
  fieldVisibility?: SOAPFieldVisibility;
}

export function SOAPNoteEditor({ soapNotes, onChange, fieldVisibility }: SOAPNoteEditorProps) {
  // Default all fields to visible if no visibility config provided
  const visibility = {
    subjective: fieldVisibility?.subjective ?? true,
    objective: fieldVisibility?.objective ?? true,
    assessment: fieldVisibility?.assessment ?? true,
    plan: fieldVisibility?.plan ?? true,
  };
  const handleChange = (field: keyof SOAPNoteData, value: string) => {
    onChange({
      ...soapNotes,
      [field]: value
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Notas Clínicas Estructuradas (SOAP)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Utilice la metodología SOAP para documentar la consulta de manera estructurada
        </p>
      </div>

      <div className="space-y-6">
        {/* Subjective */}
        {visibility.subjective && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold">
                S
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  Subjetivo (S)
                </label>
                <p className="text-xs text-gray-500">
                  Síntomas reportados por el paciente, historia clínica relevante
                </p>
              </div>
            </div>
            <textarea
              value={soapNotes.subjective || ''}
              onChange={(e) => handleChange('subjective', e.target.value)}
              rows={4}
              placeholder="¿Qué le trae al paciente? ¿Cuáles son sus síntomas? ¿Cómo se siente?&#10;Ejemplo: 'Paciente refiere dolor de cabeza desde hace 3 días, localizado en región frontal, intensidad 7/10...'"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        )}

        {/* Objective */}
        {visibility.objective && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-semibold">
                O
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  Objetivo (O)
                </label>
                <p className="text-xs text-gray-500">
                  Hallazgos del examen físico, datos objetivos, resultados de pruebas
                </p>
              </div>
            </div>
            <textarea
              value={soapNotes.objective || ''}
              onChange={(e) => handleChange('objective', e.target.value)}
              rows={4}
              placeholder="Hallazgos del examen físico, signos observados, resultados de laboratorio...&#10;Ejemplo: 'Paciente alerta y orientado, sin signos de dificultad respiratoria. Auscultación pulmonar normal...'"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
        )}

        {/* Assessment */}
        {visibility.assessment && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
                A
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  Evaluación (A)
                </label>
                <p className="text-xs text-gray-500">
                  Diagnóstico, impresión clínica, análisis de la situación
                </p>
              </div>
            </div>
            <textarea
              value={soapNotes.assessment || ''}
              onChange={(e) => handleChange('assessment', e.target.value)}
              rows={4}
              placeholder="Diagnóstico diferencial, impresión diagnóstica, análisis clínico...&#10;Ejemplo: 'Cefalea tensional probablemente secundaria a estrés laboral. Descartar migraña...'"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            />
          </div>
        )}

        {/* Plan */}
        {visibility.plan && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-semibold">
                P
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  Plan (P)
                </label>
                <p className="text-xs text-gray-500">
                  Plan de tratamiento, medicamentos, estudios adicionales, seguimiento
                </p>
              </div>
            </div>
            <textarea
              value={soapNotes.plan || ''}
              onChange={(e) => handleChange('plan', e.target.value)}
              rows={4}
              placeholder="Plan de tratamiento, medicación prescrita, estudios adicionales, educación al paciente...&#10;Ejemplo: 'Iniciar con paracetamol 500mg cada 8 horas. Manejo del estrés. Control en 7 días...'"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>
        )}
      </div>

      {/* Helper Tips */}
      <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">💡 Consejos para notas SOAP efectivas</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>S:</strong> Use las palabras del paciente cuando sea posible</li>
          <li>• <strong>O:</strong> Sea específico y cuantificable con los hallazgos</li>
          <li>• <strong>A:</strong> Liste diagnósticos diferenciales cuando aplique</li>
          <li>• <strong>P:</strong> Sea claro con dosis, frecuencia y duración de medicamentos</li>
        </ul>
      </div>
    </div>
  );
}
