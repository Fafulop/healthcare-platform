'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { BookingStatusPill } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, visitaHref } from '@/lib/visitas-ui';
import {
  ESTADO_SESION, ESTADO_TRATAMIENTO, describirAvance, detalleDeSesion, etiquetaSesion, pesos, tratamientosUiActiva,
  type CuentaDelTratamiento, type SesionDeTratamiento,
} from '@/lib/tratamientos-ui';
import { practiceConfirm } from '@/lib/practice-confirm';
import { getClinicDateString } from '@/lib/dates';
import { useTratamientoDetalle } from '../_components/useTratamientoDetalle';
import { AgendarSesionesModal } from '@/components/medical-records/tratamientos/AgendarSesionesModal';

const inputClass = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm';
const botonTexto = 'text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50';
const botonGris = 'text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50';

/**
 * TRATAMIENTOS T3 — la pantalla de UN tratamiento: sus sesiones en orden con su estado (DERIVADO
 * por el servidor, P1), la cita y la visita de cada una, y las acciones para ligarlas.
 * Plan: docs/DESDE JUNIO/VISITAS/03-PLAN-fase-2.md §4.
 */
export default function TratamientoPage() {
  const t = useTratamientoDetalle();
  const { patientId, tratamiento } = t;
  const pacienteHref = `/dashboard/medical-records/patients/${patientId}`;
  const [editando, setEditando] = useState(false);
  const [cancelando, setCancelando] = useState<SesionDeTratamiento | null>(null);
  const [agendando, setAgendando] = useState(false);

  if (t.sessionStatus === 'loading' || t.estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // `tratamientosUiActiva` ya está abierta para todos: sin `doctorId` en la sesión no se pudo cargar.
  if (!tratamientosUiActiva(t.doctorId) || t.estado !== 'ok' || !tratamiento) {
    const texto = t.estado === 'no-existe'
      ? 'Este tratamiento no existe o ya se borró.'
      : 'No se pudo cargar el tratamiento. Recarga la página para intentar de nuevo.';
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900">{texto}</p>
          <Link href={pacienteHref} className="text-amber-800 underline mt-2 inline-block">Volver al paciente</Link>
        </div>
      </div>
    );
  }

  const chip = ESTADO_TRATAMIENTO[tratamiento.estado] ?? ESTADO_TRATAMIENTO.activo;
  const creadas = tratamiento.sesiones.length;
  const planeadas = tratamiento.sesionesPlaneadas;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Encabezado */}
      <div>
        <Link href={pacienteHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft className="w-5 h-5" /> Volver al Paciente
        </Link>
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {t.patientName && <p className="text-sm text-gray-500">{t.patientName}</p>}
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                <ListChecks className="w-6 h-6 text-gray-500" />
                {tratamiento.nombre}
                <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${chip.clase}`}>{chip.texto}</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {creadas > 0 ? describirAvance({ sesionesPlaneadas: planeadas, conteo: conteoDe(tratamiento.sesiones) }) : 'Sin sesiones'}
                {planeadas !== null && creadas !== planeadas && (
                  <span className="text-gray-500"> · {creadas} {creadas === 1 ? 'creada' : 'creadas'} de {planeadas} planeadas</span>
                )}
              </p>
              {tratamiento.notas && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{tratamiento.notas}</p>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => setEditando((x) => !x)} disabled={t.trabajando} className={botonGris}>
                <Pencil className="w-4 h-4 inline mr-1" />Editar
              </button>
              {tratamiento.estado === 'activo' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'terminado' }, 'Tratamiento terminado')}
                  disabled={t.trabajando} className={botonGris}
                >Terminar</button>
              )}
              {/* Desde CUALQUIER estado que no sea cancelado: es lo que el 409 de «Borrar» pide. */}
              {tratamiento.estado !== 'cancelado' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'cancelado' }, 'Tratamiento cancelado')}
                  disabled={t.trabajando} className={botonGris}
                >Cancelar tratamiento</button>
              )}
              {tratamiento.estado !== 'activo' && (
                <button
                  onClick={() => t.patchTratamiento({ estado: 'activo' }, 'Tratamiento reactivado')}
                  disabled={t.trabajando} className={botonGris}
                >Reactivar</button>
              )}
              <button onClick={t.borrarTratamiento} disabled={t.trabajando} className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                <Trash2 className="w-4 h-4 inline mr-1" />Borrar
              </button>
            </div>
          </div>
          {editando && <EditarDatos t={t} onListo={() => setEditando(false)} />}
        </div>
      </div>

      {/* Dinero, sólo con permiso de `flujo` (si no, no viaja nada):
          · V1 — sin paquete: la CUENTA = suma de las sesiones (lo normal desde 2026-10-02);
          · T6 — con paquete (sólo tratamientos viejos, hasta V2): el paquete. */}
      {tratamiento.cuenta ? (
        <CuentaTratamiento c={tratamiento.cuenta} />
      ) : tratamiento.dinero ? (
        <DineroDelPaquete t={t} />
      ) : null}

      {/* Sesiones */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />Sesiones
          </h2>
          <div className="flex items-center gap-1">
            {/* T5: sólo con permiso de citas y si hay sesiones «Por agendar» (sin cita que cuente ni visita). */}
            {(t.permisos?.citas ?? false) && tratamiento.estado === 'activo'
              && tratamiento.sesiones.some((s) => s.estado === 'por_agendar' && !s.cancelada && !s.visita) && (
              <button onClick={() => setAgendando(true)} disabled={t.trabajando} className={`${botonTexto} flex items-center gap-1`}>
                <CalendarDays className="w-4 h-4" />Agendar sesiones…
              </button>
            )}
            <button onClick={t.agregarSesion} disabled={t.trabajando} className={`${botonTexto} flex items-center gap-1`}>
              <Plus className="w-4 h-4" />Agregar sesión
            </button>
          </div>
        </div>
        {creadas === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay sesiones. Agrega la primera cuando la necesites.</p>
        ) : (
          <div className="space-y-2">
            {tratamiento.sesiones.map((s) => (
              <FilaSesion key={s.id} s={s} t={t} planeadas={planeadas} onCancelar={() => pedirCancelar(s)} />
            ))}
          </div>
        )}
      </div>

      {agendando && (
        <AgendarSesionesModal
          patientId={patientId}
          tratamiento={tratamiento}
          onClose={() => setAgendando(false)}
          onListo={() => { t.recargar(); }}
        />
      )}

      {cancelando && (
        <CancelarSesionModal
          s={cancelando}
          planeadas={planeadas}
          trabajando={t.trabajando}
          onElegir={async (tambienCita) => {
            const s = cancelando;
            setCancelando(null);
            await t.cancelarSesion(s, tambienCita);
          }}
          onCerrar={() => setCancelando(null)}
        />
      )}
    </div>
  );

  /**
   * G8: con cita ACTIVA a la vista hay TRES salidas (también la cita · sólo la sesión · nada) y un
   * confirm de sí/no no las distingue: su «Cancelar» y el Esc acababan cancelando la sesión. Sin
   * cita activa (o sin permiso para verla) basta el confirm.
   */
  async function pedirCancelar(s: SesionDeTratamiento) {
    const citaActiva = s.cita?.status === 'PENDING' || s.cita?.status === 'CONFIRMED';
    if (citaActiva) { setCancelando(s); return; }
    const ok = await practiceConfirm(
      s.estado === 'agendada'
        ? 'La sesión quedará como cancelada. Tiene una cita que no puedes ver: seguirá en la agenda.'
        : 'La sesión quedará como cancelada. Puedes reactivarla después.',
      `¿Cancelar la ${etiquetaSesion(s.numero, null).toLowerCase()}?`,
    );
    if (ok) await t.cancelarSesion(s, false);
  }
}

function CancelarSesionModal({ s, planeadas, trabajando, onElegir, onCerrar }: {
  s: SesionDeTratamiento; planeadas: number | null; trabajando: boolean;
  onElegir: (tambienCita: boolean) => void; onCerrar: () => void;
}) {
  const dia = s.cita?.fecha ? ` del ${formatoFechaVisita(s.cita.fecha)}` : '';
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Cancelar {etiquetaSesion(s.numero, planeadas).toLowerCase()}</h2>
          <button onClick={onCerrar} className="p-1 rounded hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm text-gray-700">
          <p>Esta sesión tiene una cita{dia} que sigue activa en la agenda. ¿Qué quieres hacer con ella?</p>
          <p className="text-gray-500">
            Cancelarla aquí es lo mismo que cancelarla desde la agenda, con los mismos avisos al paciente.
          </p>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => onElegir(true)} disabled={trabajando}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
          >Cancelar la sesión y la cita</button>
          <button
            onClick={() => onElegir(false)} disabled={trabajando}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >Cancelar sólo la sesión (la cita se queda)</button>
          <button onClick={onCerrar} disabled={trabajando} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            No cancelar nada
          </button>
        </div>
      </div>
    </div>
  );
}

type Detalle = ReturnType<typeof useTratamientoDetalle>;

/** El conteo de la cabecera sale de las sesiones ya derivadas por el servidor (no se re-deriva). */
function conteoDe(sesiones: SesionDeTratamiento[]) {
  const c = { total: sesiones.length, hechas: 0, agendadas: 0, porAgendar: 0, canceladas: 0 };
  for (const s of sesiones) {
    if (s.estado === 'hecha') c.hechas++;
    else if (s.estado === 'agendada') c.agendadas++;
    else if (s.estado === 'cancelada') c.canceladas++;
    else c.porAgendar++;
  }
  return c;
}

function EditarDatos({ t, onListo }: { t: Detalle; onListo: () => void }) {
  const tr = t.tratamiento!;
  const [nombre, setNombre] = useState(tr.nombre);
  const [sesiones, setSesiones] = useState(tr.sesionesPlaneadas?.toString() ?? '');
  const [notas, setNotas] = useState(tr.notas ?? '');
  const conFlujo = tr.dinero !== undefined;
  const [precio, setPrecio] = useState(tr.dinero ? String(tr.dinero.precioPaquete) : '');

  const guardar = async () => {
    const n = sesiones.trim() ? Number(sesiones) : null;
    const ok = await t.patchTratamiento(
      // Sin plantilla sugerida hasta T4 (ver NuevoTratamientoModal): no se manda, no se toca.
      {
        nombre: nombre.trim(), sesionesPlaneadas: n, notas: notas.trim() || null,
        // T6: el precio del paquete sólo lo manda quien lo ve (`flujo`); vacío = sin paquete.
        ...(conFlujo ? { precioPaquete: precio.trim() ? Number(precio) : null } : {}),
      },
      'Tratamiento actualizado',
    );
    if (ok) onListo();
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} className={`${inputClass} w-full`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Sesiones planeadas</label>
        <input type="number" min={1} max={100} value={sesiones} onChange={(e) => setSesiones(e.target.value)} className={`${inputClass} w-32`} />
        {/* G7: cambiar el número NO crea ni borra sesiones. */}
        <p className="text-xs text-gray-500 mt-1">Cambia sólo el número del plan: no crea ni borra sesiones.</p>
      </div>
      {conFlujo && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio del paquete (opcional, MXN)</label>
          <input type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className={`${inputClass} w-40`} />
          <p className="text-xs text-gray-500 mt-1">
            Con precio, las sesiones se registran en $0 «cubiertas por el paquete» al completarlas y el pago se
            registra aparte. Vacío = cada sesión se cobra al completarla. Cambiarlo no toca lo ya registrado.
          </p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={5000} className={`${inputClass} w-full`} />
      </div>
      <div className="flex gap-2">
        <button onClick={guardar} disabled={t.trabajando || !nombre.trim()} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          Guardar
        </button>
        <button onClick={onListo} disabled={t.trabajando} className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * TRATAMIENTOS v2 · V1 — la cuenta del tratamiento: el total es la SUMA de sus sesiones (lo cobrado en
 * las que ya se cobraron, el precio planeado en las demás), lo pagado es lo que de eso ya entró, y las
 * ventas de sus visitas van en renglón aparte. Todo lo calcula el servidor.
 */
function CuentaTratamiento({ c }: { c: CuentaDelTratamiento }) {
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">Cuenta del tratamiento</h2>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-gray-500">Total</p><p className="font-semibold text-gray-900">{pesos(c.total)}</p></div>
        <div><p className="text-gray-500">Pagado</p><p className="font-semibold text-gray-900">{pesos(c.pagado)}</p></div>
        <div>
          <p className="text-gray-500">Pendiente</p>
          <p className={`font-semibold ${c.pendiente > 0 ? 'text-amber-700' : 'text-green-700'}`}>{pesos(c.pendiente)}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        El total suma cada sesión (sin las canceladas): lo que se le cobró al concluir su cita, o su precio si aún no se cobra. Lo pagado es lo que de eso ya entró.
      </p>
      {c.cobradoEnCanceladas > 0 && (
        <p className="text-xs text-gray-600">
          Sesiones canceladas cobraron {pesos(c.cobradoEnCanceladas)} (p. ej. un cargo por no asistir): entró a Flujo de Dinero, pero no cuenta como pago de las demás.
        </p>
      )}
      {c.cobradoDeMas > 0 && (
        <p className="text-xs text-blue-800">Se cobró {pesos(c.cobradoDeMas)} de más sobre el precio de las sesiones.</p>
      )}
      {c.sinPrecio > 0 && (
        <p className="text-xs text-amber-800">
          {c.sinPrecio === 1 ? '1 sesión no tiene precio' : `${c.sinPrecio} sesiones no tienen precio`}: no {c.sinPrecio === 1 ? 'cuenta' : 'cuentan'} en el total. Pónselo en la sesión.
        </p>
      )}
      {c.ventas.cuantas > 0 && (
        <p className="text-sm text-gray-700 border-t border-gray-100 pt-2">
          Ventas en las visitas de las sesiones ({c.ventas.cuantas}): {pesos(c.ventas.total)} · pagado {pesos(c.ventas.pagado)}
        </p>
      )}
    </div>
  );
}

/** T6 — precio del paquete · pagado · saldo (CALCULADOS en el servidor), los pagos, y registrar uno. */
function DineroDelPaquete({ t }: { t: Detalle }) {
  const d = t.tratamiento!.dinero;
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState('');
  const [forma, setForma] = useState('efectivo');
  const [fecha, setFecha] = useState(getClinicDateString());
  const n = Number(monto);
  const valido = monto.trim() !== '' && Number.isFinite(n) && n > 0;

  // Sólo se pinta con paquete (la página manda aquí sólo si `dinero` existe); sin paquete va la cuenta.
  if (!d) return null;
  return (
    <div className="bg-white rounded-lg shadow p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900">Paquete</h2>
        {!abierto && (
          <button onClick={() => setAbierto(true)} disabled={t.trabajando} className={botonTexto}>
            <Plus className="w-4 h-4 inline mr-1" />Registrar pago del paquete
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-gray-500">Precio</p><p className="font-semibold text-gray-900">{pesos(d.precioPaquete)}</p></div>
        <div><p className="text-gray-500">Pagado</p><p className="font-semibold text-gray-900">{pesos(d.pagado)}</p></div>
        <div>
          <p className="text-gray-500">Saldo</p>
          <p className={`font-semibold ${d.saldo > 0 ? 'text-amber-700' : 'text-green-700'}`}>{pesos(d.saldo)}</p>
        </div>
      </div>
      {d.extras > 0 && <p className="text-xs text-gray-500">Cargos extra cobrados en sesiones: {pesos(d.extras)}</p>}
      {d.pagos.length > 0 && (
        <ul className="text-xs text-gray-600 space-y-0.5">
          {d.pagos.map((p) => (
            <li key={p.id}>{formatoFechaVisita(p.fecha)} · {pesos(p.monto)}{p.formaDePago ? ` · ${p.formaDePago}` : ''}</li>
          ))}
        </ul>
      )}
      {abierto && (
        <div className="pt-3 border-t border-gray-100 space-y-2">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monto (MXN)</label>
              <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${inputClass} w-32`} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago</label>
              <select value={forma} onChange={(e) => setForma(e.target.value)} className={inputClass}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="cheque">Cheque</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Se registra como ingreso en Flujo de Dinero, ligado a este tratamiento.</p>
          <div className="flex gap-2">
            <button
              onClick={async () => { if (await t.registrarPago(n, forma, fecha)) { setAbierto(false); setMonto(''); } }}
              disabled={t.trabajando || !valido}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >Registrar pago</button>
            <button onClick={() => setAbierto(false)} disabled={t.trabajando} className="px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaSesion({ s, t, planeadas, onCancelar }: {
  s: SesionDeTratamiento; t: Detalle; planeadas: number | null; onCancelar: () => void;
}) {
  const [notas, setNotas] = useState<string | null>(null);
  const [editandoServicio, setEditandoServicio] = useState(false);
  const chip = ESTADO_SESION[s.estado];
  const detalle = detalleDeSesion(s);
  const verCitas = t.permisos?.citas ?? false;
  const cita = s.cita;

  // Se puede ligar una cita si la sesión no tiene, o si la suya ya no cuenta (cancelada / no
  // asistió: «Por agendar», y el servidor acepta cambiarla). Sólo si cargaron citas, visitas Y lo
  // ocupado: sin eso no se sabe qué rechazaría el servidor. Se quitan las que darían 409:
  //   · de otra sesión;
  //   · con su PROPIA visita, si la sesión ya guarda otra (una sesión no tiene dos visitas, G2);
  //   · de otro día, si la visita de la sesión ya tiene plantillas (regla del mismo día).
  const citaSustituible = !cita || s.motivo === 'cita_cancelada' || s.motivo === 'cita_no_asistio';
  const visitaPropia = s.visita && t.visitas ? t.visitas.find((v) => v.id === s.visita!.id) : undefined;
  const visitaPorCita = new Map((t.visitas ?? []).flatMap((v) => (v.cita ? [[v.cita.id, v.id] as const] : [])));
  const citasLigables = citaSustituible && verCitas && t.bookings && t.ocupadas && t.visitas
    ? t.bookings
        .filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && b.id !== cita?.id
          && !t.ocupadas!.citas.includes(b.id)
          && !(s.visita && visitaPorCita.has(b.id) && visitaPorCita.get(b.id) !== s.visita.id)
          && !(visitaPropia && !visitaPropia.cita && (visitaPropia.conteo?.consultas ?? 0) > 0 && b.date !== visitaPropia.fecha)
          // Si la visita guardada ya es de una cita, sólo ESA cita (una visita no es de dos citas).
          && !(visitaPropia?.cita && b.id !== visitaPropia.cita.id))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    : [];
  // Visitas que se pueden ligar (sólo SIN cita): sin cita propia y de ninguna sesión.
  const visitasLigables = !cita && !s.visita && t.visitas && t.ocupadas
    ? t.visitas.filter((v) => !v.cita && !t.ocupadas!.visitas.includes(v.id))
    : [];

  return (
    <div className={`p-4 border rounded-lg ${s.estado === 'cancelada' ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
            {etiquetaSesion(s.numero, planeadas)}
            <span className={`text-xs px-2 py-0.5 rounded-full font-normal ${chip.clase}`}>{chip.texto}</span>
          </p>
          {detalle && <p className="text-xs text-gray-500">{detalle}</p>}
          {cita && (
            cita.status ? (
              <p className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                <span>
                  Cita: {[cita.fecha ? formatoFechaVisita(cita.fecha) : 'sin fecha', cita.horaInicio, cita.servicio].filter(Boolean).join(' · ')}
                </span>
                <BookingStatusPill status={cita.status} />
              </p>
            ) : (
              <p className="text-sm text-gray-500">Tiene una cita, pero no tienes permiso para ver sus datos.</p>
            )
          )}
          {s.visita && (
            <Link href={visitaHref(t.patientId, s.visita.id)} className="text-sm text-blue-600 hover:text-blue-800 inline-block">
              Abrir su visita{s.visita.fecha ? ` (${formatoFechaVisita(s.visita.fecha)})` : ''}
            </Link>
          )}
          {s.notas && notas === null && <p className="text-sm text-gray-600 whitespace-pre-wrap">{s.notas}</p>}
          {/* V1 — su servicio y su precio (el precio sólo con `flujo`), y lo que cobró. */}
          <ServicioDeSesion s={s} cuenta={t.tratamiento?.cuenta} />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {!s.cancelada && citasLigables.length > 0 && (
            // Controlado en "": si ligar falla, vuelve al placeholder y se puede reintentar.
            <select value="" onChange={(e) => e.target.value && t.ligarCita(s, e.target.value)} disabled={t.trabajando} className={inputClass}>
              <option value="">Ligar una cita…</option>
              {citasLigables.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.date ? formatoFechaVisita(b.date) : 'Sin fecha', b.startTime, b.serviceName].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          )}
          {cita && verCitas && (
            <button onClick={() => t.desligarCita(s)} disabled={t.trabajando} className={botonGris}>Desligar cita</button>
          )}
          {!s.cancelada && visitasLigables.length > 0 && (
            <select value="" onChange={(e) => e.target.value && t.ligarVisita(s, e.target.value)} disabled={t.trabajando} className={inputClass}>
              <option value="">Ligar una visita…</option>
              {visitasLigables.map((v) => (
                <option key={v.id} value={v.id}>Visita del {formatoFechaVisita(v.fecha)}</option>
              ))}
            </select>
          )}
          {!cita && s.visita && (
            <button onClick={() => t.ligarVisita(s, null)} disabled={t.trabajando} className={botonGris}>Desligar visita</button>
          )}
          <button onClick={() => setEditandoServicio((v) => !v)} disabled={t.trabajando} className={botonGris}>
            Servicio y precio
          </button>
          <button onClick={() => setNotas(notas === null ? s.notas ?? '' : null)} disabled={t.trabajando} className={botonGris}>
            Notas
          </button>
          {s.cancelada ? (
            <button onClick={() => t.patchSesion(s, { cancelada: false }, 'Sesión reactivada')} disabled={t.trabajando} className={botonGris}>
              Reactivar
            </button>
          ) : (
            <button onClick={onCancelar} disabled={t.trabajando} className={botonGris}>Cancelar sesión</button>
          )}
          {!cita && !s.visita && (
            <button onClick={() => t.borrarSesion(s)} disabled={t.trabajando} className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
              Borrar
            </button>
          )}
        </div>
      </div>

      {editandoServicio && (
        <EditorServicioSesion
          s={s}
          conFlujo={s.precio !== undefined}
          trabajando={t.trabajando}
          onGuardar={async (body) => {
            if (await t.patchSesion(s, body, 'Sesión actualizada')) setEditandoServicio(false);
          }}
          onCerrar={() => setEditandoServicio(false)}
        />
      )}

      {notas !== null && (
        <div className="mt-3 space-y-2">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={5000} className={`${inputClass} w-full`} />
          <div className="flex gap-2">
            <button
              onClick={async () => { if (await t.patchSesion(s, { notas: notas.trim() || null }, 'Notas guardadas')) setNotas(null); }}
              disabled={t.trabajando}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >Guardar</button>
            <button onClick={() => setNotas(null)} className="px-3 py-1 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** V1 — el renglón «servicio · precio» de una sesión y lo que cobró (con el folio de su nota). */
function ServicioDeSesion({ s, cuenta }: { s: SesionDeTratamiento; cuenta?: CuentaDelTratamiento }) {
  const conFlujo = s.precio !== undefined;
  // De la cuenta: si la sesión YA se cobró (fuente `cobro`), lo cobrado y lo que de eso entró.
  const c = cuenta?.sesiones.find((x) => x.id === s.id);
  const cobrada = c?.fuente === 'cobro' && c.importe !== null;
  if (!s.servicioNombre && !conFlujo) return null;
  return (
    <p className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
      <span>{s.servicioNombre || 'Sin servicio'}</span>
      {conFlujo && (
        s.precio === null || s.precio === undefined ? (
          !cobrada && <span className="text-amber-700">· sin precio</span>
        ) : (
          <span>
            · {pesos(s.precio)}
            {s.fuente === 'cita' && <span className="text-gray-400"> (de su cita)</span>}
          </span>
        )
      )}
      {cobrada && (
        <span className={c!.pagado >= c!.importe! ? 'text-green-700' : 'text-amber-700'}>
          · cobrado {pesos(c!.importe!)}
          {c!.pagado < c!.importe! && ` · pagado ${pesos(c!.pagado)}`}
          {c!.folio ? ` (${c!.folio})` : ''}
        </span>
      )}
    </p>
  );
}

// Los servicios de Citas del doctor, frescos cada vez que se abre el editor (uno dado de alta en otra
// pestaña aparece sin recargar).
interface ServicioCita { id: string; serviceName: string; price: number | null }
const cargarServicios = () =>
  fetch('/api/doctor/services')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d) => (d.data || []) as ServicioCita[]);

/**
 * V1 — editar el servicio y el precio de UNA sesión: se elige uno de los servicios de Citas (llena
 * nombre y precio) y ambos se pueden cambiar. El precio sólo con `flujo`; si la cita de la sesión
 * aún no se concluye, el servidor le pone ese precio también (al concluirla se pre-llena).
 */
function EditorServicioSesion({ s, conFlujo, trabajando, onGuardar, onCerrar }: {
  s: SesionDeTratamiento; conFlujo: boolean; trabajando: boolean;
  onGuardar: (body: Record<string, unknown>) => void; onCerrar: () => void;
}) {
  const [servicios, setServicios] = useState<ServicioCita[] | null | 'error'>(null);
  const [servicioId, setServicioId] = useState(s.servicioId ?? '');
  const [nombre, setNombre] = useState(s.servicioNombre ?? '');
  // Sólo su precio PROPIO se pre-llena: uno heredado (de su cita) va de placeholder, para
  // que renombrar el servicio no lo copie a la sesión y la deje de ligar a su cita.
  const precioInicial = s.fuente === 'sesion' && s.precio != null ? String(s.precio) : '';
  const [precio, setPrecio] = useState(precioInicial);
  useEffect(() => {
    let vigente = true;
    cargarServicios()
      .then((x) => { if (vigente) setServicios(x); })
      .catch(() => { if (vigente) setServicios('error'); });
    return () => { vigente = false; };
  }, []);
  const n = Number(precio);
  const precioValido = precio.trim() === '' || (Number.isFinite(n) && n >= 0);

  const elegir = (id: string) => {
    setServicioId(id);
    const sv = Array.isArray(servicios) ? servicios.find((x) => x.id === id) : undefined;
    if (sv) {
      setNombre(sv.serviceName);
      if (conFlujo && sv.price != null) setPrecio(String(sv.price));
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        <select value={servicioId} onChange={(e) => elegir(e.target.value)} disabled={!Array.isArray(servicios)} className={inputClass}>
          <option value="">{servicios === null ? 'Cargando servicios…' : servicios === 'error' ? 'No se pudieron cargar los servicios' : 'Elegir un servicio…'}</option>
          {Array.isArray(servicios) && servicios.map((sv) => (
            <option key={sv.id} value={sv.id}>{sv.serviceName}{sv.price != null ? ` · ${pesos(sv.price)}` : ''}</option>
          ))}
        </select>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={255} placeholder="Nombre del servicio" className={`${inputClass} flex-1 min-w-[10rem]`} />
        {conFlujo && (
          <input
            value={precio} onChange={(e) => setPrecio(e.target.value)} inputMode="decimal"
            placeholder={s.fuente === 'cita' && s.precio != null ? `${pesos(s.precio)} (de su cita)` : 'Precio'}
            className={`${inputClass} w-40`}
          />
        )}
      </div>
      {!precioValido && <p className="text-xs text-red-700">El precio debe ser un número mayor o igual a 0.</p>}
      <div className="flex gap-2">
        <button
          onClick={() => {
            // Sólo lo que CAMBIÓ: re-enviar lo mismo no es editar (el servidor contestaría «Nada que
            // actualizar») ni debe convertir un precio heredado en propio.
            const body: Record<string, unknown> = {};
            if ((servicioId || null) !== (s.servicioId ?? null)) body.servicioId = servicioId || null;
            if ((nombre.trim() || null) !== (s.servicioNombre ?? null)) body.servicioNombre = nombre.trim() || null;
            if (conFlujo && precio.trim() !== precioInicial) body.precio = precio.trim() === '' ? null : n;
            if (Object.keys(body).length === 0) { onCerrar(); return; }
            onGuardar(body);
          }}
          disabled={trabajando || !precioValido}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >Guardar</button>
        <button onClick={onCerrar} className="px-3 py-1 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">Cancelar</button>
      </div>
    </div>
  );
}
