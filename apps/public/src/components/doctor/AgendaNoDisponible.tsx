/**
 * TIERS 04 §12.6 #6.2b — lo que ve un paciente cuando la cuenta del doctor está
 * CONGELADA (dejó de pagar y no cabe en el plan Gratis).
 *
 * Qué dice y qué NO dice:
 *
 * - NO dice por qué. La situación de cobro entre el doctor y nosotros no es
 *   asunto del paciente, y publicarla dañaría a un doctor que probablemente
 *   vuelva. Por eso la API pública sirve `aceptaCitasEnLinea` (un booleano) y ya
 *   no `congeladaDesde` (una fecha que delataba que dejó de pagar, y cuándo).
 * - NO dice «no hay horarios disponibles». Eso sería falso de otra manera: el
 *   paciente entendería que el doctor está lleno y volvería mañana a intentarlo.
 *   La agenda en línea está cerrada, que es distinto.
 * - SÍ deja un camino: el teléfono y el WhatsApp del consultorio siguen en la
 *   página. Al doctor congelado se le cierra la agenda en línea, no el negocio,
 *   y al paciente no se le deja sin manera de llegar.
 */

import { CalendarOff, Phone } from 'lucide-react';

export default function AgendaNoDisponible({ telefono }: { telefono?: string | null }) {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg text-center">
      <CalendarOff className="w-8 h-8 text-gray-400 mx-auto" aria-hidden="true" />
      <p className="mt-3 text-base font-semibold text-gray-900">
        Este doctor no está recibiendo citas en línea por ahora
      </p>
      <p className="mt-1.5 text-sm text-gray-600">
        Puedes comunicarte directamente al consultorio para agendar.
      </p>
      {telefono && (
        <a
          href={`tel:${telefono.replace(/[^\d+]/g, '')}`}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Phone className="w-4 h-4" aria-hidden="true" />
          Llamar al consultorio
        </a>
      )}
    </div>
  );
}
