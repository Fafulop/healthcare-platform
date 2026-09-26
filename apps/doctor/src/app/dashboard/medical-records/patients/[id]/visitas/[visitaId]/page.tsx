'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, CalendarDays, FileText, Image as ImageIcon, Loader2, NotebookPen, Pill, Plus, Trash2,
} from 'lucide-react';
import { ENCOUNTER_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/components/medical-records/EncounterCard';
import { BookingStatusPill, FacturaBadge, PagoBadge } from '@/components/medical-records/CitaBadges';
import { formatoFechaVisita, totalHijos, visitasUiActiva } from '@/lib/visitas-ui';
import { useVisitaDetalle, type ConsultaDeVisita } from '../_components/useVisitaDetalle';

// Los tres `origen` que existen: D1 ('cita'), la API de D2 ('manual') y el script de backfill
// ('backfill', una visita por cada consulta registrada antes de que existieran las visitas).
const ORIGEN_TEXTO: Record<string, string> = {
  cita: 'Se abrió sola al concluir la cita.',
  manual: 'Abierta a mano.',
  backfill: 'Creada a partir de una consulta registrada antes de que existieran las visitas.',
};

const RECETA_ESTADO: Record<string, string> = {
  draft: 'Borrador', issued: 'Emitida', cancelled: 'Cancelada', expired: 'Expirada',
};

function Seccion({ icon, titulo, accion, children }: {
  icon: React.ReactNode; titulo: string; accion?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">{icon}{titulo}</h2>
        {accion}
      </div>
      {children}
    </div>
  );
}

function BotonAgregar({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50">
      <Plus className="w-4 h-4" />{children}
    </Link>
  );
}

const Nada = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-gray-400">{children}</p>;

/**
 * VISITAS D4 — la pantalla de UNA visita: lo que pasó ese día, junto. Cada "+" abre la página que
 * ya existe con `?visitaId=` (no se duplican los editores: voz, chat IA y plantillas siguen igual).
 * Diseño: docs/DESDE JUNIO/VISITAS/01-DISENO-visitas-y-tratamientos.md §3, §6, §7.
 */
export default function VisitaPage() {
  const v = useVisitaDetalle();
  const { patientId, visitaId, visita } = v;
  const pacienteHref = `/dashboard/medical-records/patients/${patientId}`;

  const [comentario, setComentario] = useState('');
  const [fecha, setFecha] = useState('');
  // Se re-sincroniza sólo cuando cambia lo GUARDADO (primitivos), no en cada recarga: cada
  // escritura (mover, traer, ligar) recarga `visita` y, con `[visita]`, borraba lo que el doctor
  // llevaba escrito sin guardar.
  const comentarioGuardado = visita?.comentario ?? '';
  const fechaGuardada = visita?.fecha ?? '';
  useEffect(() => { setComentario(comentarioGuardado); }, [comentarioGuardado]);
  useEffect(() => { setFecha(fechaGuardada); }, [fechaGuardada]);

  if (v.sessionStatus === 'loading' || v.estado === 'cargando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // 🚧 Hasta el lanzamiento, sólo la lista de `lib/visitas-ui.ts` (ver ahí por qué).
  if (!visitasUiActiva(v.doctorId) || v.estado !== 'ok' || !visita) {
    const texto = !visitasUiActiva(v.doctorId)
      ? 'Las visitas todavía no están disponibles en tu cuenta.'
      : v.estado === 'no-existe' ? 'Esta visita no existe o ya se borró.'
      : 'No se pudo cargar la visita. Recarga la página para intentar de nuevo.';
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900">{texto}</p>
          <Link href={pacienteHref} className="text-amber-800 underline mt-2 inline-block">Volver al paciente</Link>
        </div>
      </div>
    );
  }

  const conVisita = (ruta: string) => `${pacienteHref}/${ruta}${ruta.includes('?') ? '&' : '?'}visitaId=${visitaId}`;
  const cita = visita.cita;
  const verCitas = v.permisos?.citas ?? false;
  const verCobro = v.permisos?.flujo ?? false;
  const verFactura = v.permisos?.facturacion ?? false;
  const booking = cita && v.bookings ? v.bookings.find((b) => b.id === cita.id) : undefined;
  const vacia = totalHijos({
    consultas: visita.consultas.length, fotos: visita.fotos.length, recetas: visita.recetas.length,
    notas: visita.notas.length, informes: visita.informes.length,
  }) === 0;

  // Citas que se pueden ligar: del paciente, ni canceladas ni no-show, y sin visita. Sólo si ya
  // cargaron las otras visitas — sin ellas no se sabe cuáles ya tienen la suya.
  // Con plantillas, la visita ya tiene día (el de sus plantillas, DISEÑO §3): sólo se ligan citas
  // de ESE día y la fecha no se edita — si no, la visita diría un día y sus plantillas otro.
  const conPlantillas = visita.consultas.length > 0;
  const conVisitaYa = new Set((v.otrasVisitas ?? []).flatMap((o) => (o.cita ? [o.cita.id] : [])));
  const ligables = v.otrasVisitas && v.bookings
    ? v.bookings.filter((b) =>
        b.status !== 'CANCELLED' && b.status !== 'NO_SHOW' && !conVisitaYa.has(b.id)
        && (!conPlantillas || b.date === visita.fecha))
    : [];

  // «Una sola verdad» de la fecha (DISEÑO §3): la fecha de una plantilla ES la de su visita. Mover
  // o traer NO reescribe `encounterDate` (sería editar el registro clínico por la espalda), así que
  // sólo se ofrecen visitas / consultas del MISMO día. Otro día = otra visita.
  const diaDe = (c: ConsultaDeVisita) => c.encounterDate.slice(0, 10);
  const destinosPara = (c: ConsultaDeVisita) => (v.otrasVisitas ?? []).filter((o) => o.fecha === diaDe(c));
  const traibles = (v.sueltas ?? []).filter((s) => diaDe(s) === visita.fecha);
  const destinos = v.otrasVisitas ?? [];
  const moverA = (c: ConsultaDeVisita, valor: string) => {
    if (!valor) return;
    const destino = valor === '__sin__' ? null : valor;
    const texto = destino
      ? `la visita del ${formatoFechaVisita(destinos.find((d) => d.id === destino)!.fecha)}`
      : '«Sin visita»';
    v.moverConsulta(c.id, destino, texto);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Encabezado */}
      <div>
        <Link href={pacienteHref} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3">
          <ArrowLeft className="w-5 h-5" /> Volver al Paciente
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Visita del {formatoFechaVisita(visita.fecha, { day: 'numeric', month: 'long', year: 'numeric' })}
            </h1>
            {v.patientName && <p className="text-base font-medium text-gray-700 mt-1">{v.patientName}</p>}
            <p className="text-sm text-gray-500 mt-1">
              {ORIGEN_TEXTO[visita.origen] ?? ''}
              {vacia && ' Todavía está vacía.'}
            </p>
          </div>
          {/* Borrar sólo mientras esté vacía (la API también lo exige: 409 con contenido). */}
          {vacia && (
            <button
              onClick={v.borrar}
              disabled={v.trabajando}
              className="px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5 text-sm self-start"
            >
              <Trash2 className="w-4 h-4" /> Borrar visita
            </button>
          )}
        </div>
      </div>

      {/* La cita: fecha, hora y cobro son de la AGENDA; aquí sólo se leen. */}
      <Seccion icon={<CalendarDays className="w-5 h-5 text-teal-600" />} titulo="Cita">
        {cita ? (
          cita.status ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-800">
                  {cita.fecha ? formatoFechaVisita(cita.fecha) : 'Sin fecha'}
                  {cita.horaInicio && ` · ${cita.horaInicio}`}{cita.horaFin && `–${cita.horaFin}`}
                </span>
                <BookingStatusPill status={cita.status} />
              </div>
              {cita.servicio && <p className="text-sm text-gray-600">{cita.servicio}</p>}
              {booking && (verCobro || verFactura) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {verCobro && <PagoBadge estadoPago={booking.estadoPago ?? 'SIN_REGISTRO'} metodoPago={booking.metodoPago ?? null} />}
                  {verFactura && <FacturaBadge facturada={booking.facturada === true} solicitada={booking.facturaSolicitada === true} />}
                </div>
              )}
              {/* La visita automática ES la de su cita: no se desliga (la API contesta 409). */}
              {visita.origen !== 'cita' && verCitas && (
                <button
                  onClick={() => v.ligarCita(null)}
                  disabled={v.trabajando}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Desligar la cita
                </button>
              )}
            </div>
          ) : (
            // Sin permiso de `citas` sólo llega el id: HAY cita, no se puede ver.
            <Nada>Esta visita tiene una cita, pero no tienes permiso para ver sus datos.</Nada>
          )
        ) : verCitas && ligables.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Sin cita.</span>
            {/* Controlado en "": si ligar falla, el select vuelve al placeholder y se puede reintentar. */}
            <select
              value=""
              disabled={v.trabajando}
              onChange={(e) => { if (e.target.value) v.ligarCita(e.target.value); }}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Ligar una cita…</option>
              {ligables.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.date ? formatoFechaVisita(b.date) : 'Sin fecha', b.startTime, b.serviceName].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Nada>Sin cita.</Nada>
        )}

        {/* Sin cita, la fecha es de la visita y se puede corregir. Con cita, manda la cita. */}
        {!cita && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <label className="text-sm text-gray-600">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={conPlantillas}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500"
            />
            {conPlantillas && (
              <span className="text-xs text-gray-500">Es la fecha de sus plantillas; no se cambia.</span>
            )}
            {fecha && fecha !== visita.fecha && (
              <button
                onClick={() => v.guardarFecha(fecha)}
                disabled={v.trabajando}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            )}
          </div>
        )}
      </Seccion>

      {/* Plantillas = cada plantilla llenada (hoy `ClinicalEncounter`), incluida la «plantilla SOAP». */}
      <Seccion
        icon={<FileText className="w-5 h-5 text-blue-600" />}
        titulo="Plantillas"
        accion={<BotonAgregar href={conVisita('encounters/new')}>Agregar plantilla</BotonAgregar>}
      >
        {visita.consultas.length > 0 ? (
          <div className="space-y-2">
            {visita.consultas.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 p-3 border border-gray-200 rounded-lg">
                <Link href={`${pacienteHref}/encounters/${c.id}`} className="min-w-0 flex-1 hover:text-blue-700">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {c.chiefComplaint || (c.templateId ? 'Plantilla personalizada' : 'Plantilla SOAP')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{ENCOUNTER_TYPE_LABELS[c.encounterType] ?? c.encounterType}</p>
                </Link>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-800'}`}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                {v.otrasVisitas && (
                  <select
                    value=""
                    disabled={v.trabajando}
                    onChange={(e) => moverA(c, e.target.value)}
                    className="text-xs px-1.5 py-1 border border-gray-200 rounded text-gray-600 max-w-[9rem]"
                    aria-label="Mover a otra visita"
                  >
                    <option value="">Mover a…</option>
                    {destinosPara(c).map((d) => (
                      <option key={d.id} value={d.id}>
                        Otra visita del {formatoFechaVisita(d.fecha)}{d.cita?.horaInicio ? ` · ${d.cita.horaInicio}` : ''}
                      </option>
                    ))}
                    <option value="__sin__">Sin visita</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Nada>Ninguna plantilla todavía.</Nada>
        )}

        {/* Traer una consulta registrada fuera de una visita (las «Consultas sin visita» del paciente). */}
        {traibles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Hay consultas sin visita de este mismo día.</span>
            <select
              value=""
              disabled={v.trabajando}
              onChange={(e) => { if (e.target.value) v.traerConsulta(e.target.value); }}
              className="text-xs px-1.5 py-1 border border-gray-200 rounded text-gray-600"
            >
              <option value="">Traerla aquí…</option>
              {traibles.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatoFechaVisita(s.encounterDate.slice(0, 10))} · {s.chiefComplaint || ENCOUNTER_TYPE_LABELS[s.encounterType] || 'Consulta'}
                </option>
              ))}
            </select>
          </div>
        )}
      </Seccion>

      <Seccion
        icon={<ImageIcon className="w-5 h-5 text-purple-600" />}
        titulo="Fotos y documentos"
        accion={<BotonAgregar href={conVisita('media/upload')}>Subir</BotonAgregar>}
      >
        {visita.fotos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {visita.fotos.map((f) => (
              <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="block group" title={f.description || f.fileName}>
                {f.mediaType === 'image' ? (
                  <img src={f.thumbnailUrl || f.fileUrl} alt={f.fileName} className="w-full aspect-square object-cover rounded-md border border-gray-200 group-hover:border-blue-300" />
                ) : (
                  <div className="w-full aspect-square rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center p-1 group-hover:border-blue-300">
                    <span className="text-[11px] text-gray-600 text-center break-all line-clamp-3">{f.fileName}</span>
                  </div>
                )}
              </a>
            ))}
          </div>
        ) : (
          <Nada>Ninguna foto ni documento todavía.</Nada>
        )}
      </Seccion>

      <Seccion
        icon={<NotebookPen className="w-5 h-5 text-amber-600" />}
        titulo="Notas"
        accion={<BotonAgregar href={conVisita('notas')}>Nueva nota</BotonAgregar>}
      >
        {visita.notas.length > 0 ? (
          <div className="space-y-2">
            {visita.notas.map((n) => (
              <Link key={n.id} href={`${pacienteHref}/notas`} className="block px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50">
                <p className="text-sm text-gray-900 line-clamp-2 whitespace-pre-wrap">{n.content.trim() || 'Nota vacía'}</p>
              </Link>
            ))}
          </div>
        ) : (
          <Nada>Ninguna nota todavía.</Nada>
        )}
      </Seccion>

      <Seccion
        icon={<Pill className="w-5 h-5 text-green-600" />}
        titulo="Recetas"
        accion={<BotonAgregar href={conVisita('prescriptions/new')}>Nueva receta</BotonAgregar>}
      >
        {visita.recetas.length > 0 ? (
          <div className="space-y-2">
            {visita.recetas.map((r) => (
              <Link key={r.id} href={`${pacienteHref}/prescriptions/${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50">
                <span className="text-sm text-gray-900 truncate">{r.diagnosis || 'Receta'}</span>
                <span className="text-xs text-gray-500 shrink-0">{RECETA_ESTADO[r.status] ?? r.status}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Nada>Ninguna receta todavía.</Nada>
        )}
      </Seccion>

      {/* Informes: siempre cuelgan de una plantilla (su consulta); se crean desde ella. */}
      {visita.informes.length > 0 && (
        <Seccion icon={<FileText className="w-5 h-5 text-gray-600" />} titulo="Informes médicos">
          <div className="space-y-2">
            {visita.informes.map((i) => (
              <Link key={i.id} href={`${pacienteHref}/encounters/${i.encounterId}/informe`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-100 hover:bg-gray-50">
                <span className="text-sm text-gray-900">Informe médico</span>
                <span className="text-xs text-gray-500">{i.status === 'issued' ? 'Emitido' : 'Borrador'}</span>
              </Link>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion icon={<AlertCircle className="w-5 h-5 text-gray-400" />} titulo="Comentario">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Algo que quieras recordar de esta visita"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {comentario.trim() !== (visita.comentario ?? '') && (
          <button
            onClick={() => v.guardarComentario(comentario)}
            disabled={v.trabajando}
            className="mt-2 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Guardar comentario
          </button>
        )}
      </Seccion>
    </div>
  );
}
