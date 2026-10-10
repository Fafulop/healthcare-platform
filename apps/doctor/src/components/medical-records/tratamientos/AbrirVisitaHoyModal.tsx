'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/lib/practice-toast';
import { visitaHref } from '@/lib/visitas-ui';
import { etiquetaSesion, pesos, type SesionDeTratamiento } from '@/lib/tratamientos-ui';
import { horaDeAhora, useCitaEnConsulta } from '@/components/medical-records/visitas/useCitaEnConsulta';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

/**
 * VISITAS 07-PLAN P3b → 09-PLAN L3 — «Abrir visita hoy» de una sesión SIN cita que cuente. Visita y cita
 * son el mismo evento y TODA visita lleva su cita (nota N2, 2026-10-10): nace su cita de HOY
 * (`enConsulta`: sin exigir correo/teléfono/WhatsApp y sin avisar al paciente, que está enfrente),
 * Agendada, que se cobra al completarla como cualquier otra; la visita nace con ella. Ya no hay casilla
 * «También en la agenda» ni visita sola. Sólo se abre con permiso de citas y el tratamiento activo (lo
 * decide la tarjeta de la sesión). La cita la crea `useCitaEnConsulta` (la misma que «Nueva Visita»).
 */
export function AbrirVisitaHoyModal({ patientId, s, planeadas, onClose, onFallo }: {
  patientId: string;
  s: SesionDeTratamiento;
  planeadas: number | null;
  onClose: () => void;
  /** Algo quedó a medias (la cita sí, la visita no): re-leer el tratamiento. */
  onFallo: () => void;
}) {
  const router = useRouter();
  const c = useCitaEnConsulta(patientId, true);
  const [servicioId, setServicioId] = useState(s.servicioId ?? '');
  const [hora, setHora] = useState(horaDeAhora);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const listoParaAgenda = c.listoPara(servicioId, hora);

  const confirmar = async () => {
    setError(null);
    if (!listoParaAgenda) return;
    setTrabajando(true);
    const r = await c.crear({ servicioId, hora, paraSesion: s.id });
    if (!r.ok) {
      // Traslape, horario bloqueado…: se queda en el modal para cambiar la hora.
      setError(r.error);
      setTrabajando(false);
      return;
    }
    if (!r.sesionLigada) {
      // La cita existe pero no quedó en la sesión: no se abre una visita que no sería de ella.
      toast.error('La cita se creó, pero no quedó en la sesión: cancélala desde la agenda y vuelve a intentar.');
      onFallo();
      onClose();
      return;
    }
    // 08-PLAN F2: la cita ya NACIÓ con su visita (y la sesión la guardó): se abre ésa.
    if (r.visitaId) { router.push(visitaHref(patientId, r.visitaId)); return; }
    try {
      // API de antes (o la visita no nació): se crea la de la cita; entra sola a la sesión (G3).
      const res = await fetch(`/api/medical-records/patients/${patientId}/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: r.bookingId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.data?.id) throw new Error(d?.error);
      router.push(visitaHref(patientId, d.data.id));
    } catch {
      toast.error('La cita se creó, pero la visita no: ábrela desde la sesión.');
      onFallo();
      onClose();
    }
  };

  const elegido = Array.isArray(c.servicios) ? c.servicios.find((x) => x.id === servicioId) : undefined;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Abrir visita hoy · {etiquetaSesion(s.numero, planeadas)}</h2>
          <button onClick={onClose} disabled={trabajando} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-sm">
          <p className="text-gray-700">
            Se agenda su cita de <strong>hoy</strong> (sin avisarle al paciente: está contigo) y la visita nace con
            ella; la sesión se cobra al completar la cita. Si la sesión es otro día, mejor agéndala.
          </p>

          <CamposDeCita
            c={c} servicioId={servicioId} setServicioId={setServicioId} hora={hora} setHora={setHora}
            aviso={elegido && s.precio != null && s.fuente === 'sesion' && s.precio !== elegido.price
              ? `La cita toma el precio de la sesión: ${pesos(s.precio)}.` : null}
          />

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={trabajando} className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={trabajando || !listoParaAgenda}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 font-medium"
          >
            {trabajando && <Loader2 className="w-4 h-4 animate-spin" />}
            Abrir visita y agendar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Servicio y hora de la cita (la de hoy aquí; la de cualquier día en «Nueva Visita»). */
export function CamposDeCita({ c, servicioId, setServicioId, hora, setHora, aviso }: {
  c: ReturnType<typeof useCitaEnConsulta>;
  servicioId: string; setServicioId: (v: string) => void;
  hora: string; setHora: (v: string) => void;
  aviso?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
        <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} disabled={!Array.isArray(c.servicios)} className={inputClass}>
          <option value="">
            {c.servicios === null ? 'Cargando servicios…' : c.servicios === 'error' ? 'No se pudieron cargar los servicios' : 'Elige un servicio…'}
          </option>
          {Array.isArray(c.servicios) && c.servicios.map((x) => (
            <option key={x.id} value={x.id}>{x.serviceName}{x.price != null ? ` · ${pesos(x.price)}` : ''}</option>
          ))}
        </select>
        {aviso && <p className="text-xs text-gray-500 mt-1">{aviso}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={inputClass} />
      </div>
      {!c.paciente && <p className="text-xs text-gray-500">Cargando al paciente…</p>}
    </div>
  );
}
