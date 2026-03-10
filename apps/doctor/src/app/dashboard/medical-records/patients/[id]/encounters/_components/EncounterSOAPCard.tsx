import { ClipboardList } from 'lucide-react';
import type { Encounter } from './encounter-types';

type Props = Pick<Encounter, 'subjective' | 'objective' | 'assessment' | 'plan'>;

export function EncounterSOAPCard({ subjective, objective, assessment, plan }: Props) {
  if (!subjective && !objective && !assessment && !plan) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <ClipboardList className="w-4 h-4 text-green-600" />
        Notas SOAP
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {subjective && (
          <div className="border-l-4 border-blue-500 pl-3 py-1">
            <h4 className="text-xs font-semibold text-blue-700 uppercase mb-1">S - Subjetivo</h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{subjective}</p>
          </div>
        )}
        {objective && (
          <div className="border-l-4 border-green-500 pl-3 py-1">
            <h4 className="text-xs font-semibold text-green-700 uppercase mb-1">O - Objetivo</h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{objective}</p>
          </div>
        )}
        {assessment && (
          <div className="border-l-4 border-yellow-500 pl-3 py-1">
            <h4 className="text-xs font-semibold text-yellow-700 uppercase mb-1">A - Evaluación</h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{assessment}</p>
          </div>
        )}
        {plan && (
          <div className="border-l-4 border-purple-500 pl-3 py-1">
            <h4 className="text-xs font-semibold text-purple-700 uppercase mb-1">P - Plan</h4>
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{plan}</p>
          </div>
        )}
      </div>
    </div>
  );
}
