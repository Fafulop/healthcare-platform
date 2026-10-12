'use client';

/**
 * «Citas e Ingresos»: cada cita del paciente con su cobro y su factura (Facturar con sus datos fiscales,
 * PDF/XML del CFDI, los borradores del asistente). (Sin «Nueva factura manual» desde 2026-10-12.)
 *
 * VISITAS 10-PLAN P2/P3: vivía dentro del perfil del paciente (`patients/[id]/page.tsx`). Se movió aquí SIN
 * cambiarle nada y desde P3 sólo la usa la página «Cobros» (el perfil enseña `ResumenCobros`). Lo único
 * nuevo: `extraPorCita` (al pie de cada cita), `titulo` y `datosFiscalesHref`.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, DollarSign, Receipt, AlertCircle, CheckCircle } from 'lucide-react';
import { NotasCita } from '@/components/citas/NotasCita';
import { ListaColapsable } from '@/components/medical-records/ListaColapsable';
import { BookingStatusPill, FacturaBadge, PagoBadge, type PatientBooking } from '@/components/medical-records/CitaBadges';
import type { BookingPermisos } from '@/lib/booking-permisos';
import type { Patient } from '@/app/dashboard/medical-records/patients/_components/patient-types';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

/** TRES estados, no dos: si la carga falla, la lista vacía NO puede decir "no hay citas". */
export type BookingsEstado = 'cargando' | 'error' | 'ok';

interface CitasIngresosSectionProps {
  bookings: PatientBooking[];
  /** null mientras carga o si falló (ver `estado`). */
  permisos: BookingPermisos | null;
  estado: BookingsEstado;
  patient: Patient;
  /** 10-PLAN P2 («Cobros»): algo más al pie de cada cita — su visita y la tarjeta completa de la cita. */
  extraPorCita?: (b: PatientBooking) => ReactNode;
  /** «Cobros» ya dice el título de la página. */
  titulo?: string;
  /** Dónde se capturan los datos fiscales: en el perfil, su tarjeta (#datos-fiscales); fuera, el perfil. */
  datosFiscalesHref?: string;
}

interface CfdiDraft {
  id: number;
  ledgerEntryId: number | null;
  items: { description: string; unitPrice: number; quantity: number }[];
  createdAt: string;
}

/** F2c: pending CFDI drafts of this patient (prepared by the agent). Fetched
 *  ONCE per expediente and repartidos por ingreso — cada borrador se pinta
 *  DENTRO de la tarjeta de su cita, no flotando encima de la lista: un borrador
 *  siempre cuelga de un ingreso (`ledgerEntryId`), o sea de una cita concreta,
 *  y suelto arriba no se sabía de cuál. */
export function useCfdiDrafts(patientId: string, bookingEntryIds: Set<number>, enabled: boolean) {
  const [drafts, setDrafts] = useState<CfdiDraft[]>([]);

  const fetchDrafts = useCallback(async () => {
    // Sin `facturacion` la ruta contesta 403: ni se pide.
    if (!enabled) return;
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/drafts?patientId=${patientId}&status=draft`);
      if (res.ok) {
        const { data } = await res.json();
        if (Array.isArray(data)) setDrafts(data);
      }
    } catch { /* silent: sin borradores la tarjeta se pinta igual */ }
  }, [patientId, enabled]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const discard = useCallback(async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/drafts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'discard' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Borrador descartado');
      fetchDrafts();
    } catch {
      toast.error('No se pudo descartar el borrador');
    }
  }, [fetchDrafts]);

  // El reparto NO puede ser "null ⇒ suelto, lo demás ⇒ su tarjeta": un borrador
  // puede colgar de un ingreso que NO es ninguna de estas citas (un ingreso
  // manual con paciente, un sat_recibido, una entrada fusionada). Ese borrador no
  // encontraría tarjeta donde pintarse y quedaría INVISIBLE — y no es cosmético:
  // la API rechaza crear un segundo borrador para el mismo ingreso (409), así que
  // uno invisible bloquea para siempre preparar otro y no deja botón para
  // descartarlo. Sin tarjeta que lo aloje, arriba.
  const byLedgerEntry = new Map<number, CfdiDraft[]>();
  const sueltos: CfdiDraft[] = [];
  for (const d of drafts) {
    if (d.ledgerEntryId == null || !bookingEntryIds.has(d.ledgerEntryId)) {
      sueltos.push(d);
      continue;
    }
    byLedgerEntry.set(d.ledgerEntryId, [...(byLedgerEntry.get(d.ledgerEntryId) ?? []), d]);
  }
  return { byLedgerEntry, sueltos, discard };
}

function CfdiDraftRow({
  draft, onDiscard, ingresoYaFacturado = false,
}: { draft: CfdiDraft; onDiscard: (id: number) => void; ingresoYaFacturado?: boolean }) {
  const router = useRouter();
  const items = draft.items ?? [];
  const total = items.reduce((s, it) => s + it.unitPrice * (it.quantity || 1), 0);

  // Borrador MUERTO: su ingreso ya se facturó por otro camino. Abrirlo solo
  // llevaría al 409 de POST /cfdi ("ese ingreso ya tiene una factura ligada"),
  // así que se ofrece lo único que queda por hacer con él: descartarlo.
  if (ingresoYaFacturado) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-xs text-gray-500 min-w-0">
          <span className="font-medium">Borrador de factura #{draft.id}</span> — este ingreso ya se
          facturó por otro camino, así que el borrador ya no aplica.
        </div>
        <button
          onClick={() => onDiscard(draft.id)}
          className="text-xs px-2 py-1 rounded bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
        >
          Descartar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
      <div className="text-xs text-blue-900 min-w-0">
        <span className="font-medium">Borrador de factura #{draft.id}</span>
        <span className="text-blue-700"> · {items.length} concepto(s) · subtotal {formatCurrency(total)}</span>
        <span className="text-blue-600 ml-1">
          ({new Date(draft.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })})
        </span>
        <p className="text-[11px] text-blue-700 mt-0.5">
          Preparado por el asistente — nada se ha timbrado. Se emite en Facturación, cuando tú lo confirmes ahí.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* "Revisar y emitir" prometía de más: este botón NO timbra, solo abre el
            formulario de Nueva Factura con el borrador cargado. Quien timbra es
            el doctor, en esa página. */}
        <button
          onClick={() => router.push(`/dashboard/facturacion?draft=${draft.id}`)}
          className="text-xs px-2.5 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
        >
          Revisar en Facturación
        </button>
        <button
          onClick={() => onDiscard(draft.id)}
          className="text-xs px-2 py-1.5 rounded bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export function CitasIngresosSection({ bookings, permisos, estado, patient, extraPorCita, titulo = 'Citas', datosFiscalesHref }: CitasIngresosSectionProps) {
  // Los datos fiscales se capturan en el PERFIL (su tarjeta), no aquí.
  const hrefDatosFiscales = datosFiscalesHref ?? `/dashboard/medical-records/patients/${patient.id}#datos-fiscales`;
  const router = useRouter();
  // Qué bloques se pintan: lo decide el SERVIDOR (y además no manda lo que no se
  // puede ver). Mientras no llegan los permisos, CERRADO: sin esto un member sin
  // `facturacion` veía un instante «Nueva factura manual» y se pedía una ruta que
  // le contesta 403. (Al dueño le llegan todos en true: no cambia nada.)
  const verCitas = permisos?.citas ?? false;
  const verCobro = permisos?.flujo ?? false;
  const verFactura = permisos?.facturacion ?? false;
  // Las CANCELADAS no se listan: no hay nada que cobrar ni que facturar en una
  // cita que no ocurrió, y ocupaban la lista con chips que no llevaban a ninguna
  // acción. (Medido antes de decidirlo: cero citas canceladas en prod tienen un
  // ingreso, así que esto no esconde dinero de nadie.)
  //
  // Las más nuevas ARRIBA, ordenadas aquí y no confiando en el servidor: ordena por
  // `slot.date` primero y en Postgres un DESC pone los NULL al principio, así que TODAS
  // las citas sin slot (rango / hora escrita — hoy todas las nuevas) quedaban encima de
  // las de slot sin importar su fecha, y las del mismo día iban por `createdAt`, no por
  // hora. Con la lista recortada a 3 eso enseñaba las 3 equivocadas. Sin fecha → al final
  // (en DESC, '' queda después de cualquier fecha). Mismo orden que «Nueva Visita».
  const citasVisibles = bookings
    .filter((b) => b.status !== 'CANCELLED')
    .sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '') || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  const bookingEntryIds = new Set(
    citasVisibles.map((b) => b.ledgerEntryId).filter((id): id is number => id != null)
  );
  const { byLedgerEntry: draftsByEntry, sueltos: draftsSueltos, discard: discardDraft } =
    useCfdiDrafts(patient.id, bookingEntryIds, verFactura);

  // ⚠️ DOS preguntas distintas, antes mezcladas en un solo `hasFiscalData`:
  //   · ¿PODEMOS facturar?  → los cinco campos del receptor. Es lo único que
  //     condiciona el botón: sin ellos el SAT rechaza el timbrado.
  //   · ¿QUIERE factura?    → `requiereFactura` (expediente) y, por cita, la
  //     casilla `facturaSolicitada` de la tabla de citas.
  // Mezcladas, una cita marcada "necesita factura" para un paciente cuyo
  // `requiereFactura` está en false escondía el botón sin decir por qué.
  const fiscalDataComplete = !!(
    patient.rfc &&
    patient.razonSocial &&
    patient.regimenFiscal &&
    patient.usoCfdi &&
    patient.codigoPostalFiscal
  );

  const handleEmitCfdi = (booking: PatientBooking) => {
    if (!fiscalDataComplete || !booking.ledgerEntryId || !booking.amount) return;
    const params = new URLSearchParams({
      from: 'booking',
      ledgerId: String(booking.ledgerEntryId),
      concept: booking.serviceName || 'Consulta médica',
      amount: String(booking.amount),
      clientName: patient.razonSocial!,
      formaDePago: booking.formaDePago || 'efectivo',
      rfc: patient.rfc!,
      fiscalRegime: patient.regimenFiscal!,
      cfdiUse: patient.usoCfdi!,
      taxZipCode: patient.codigoPostalFiscal!,
    });
    router.push(`/dashboard/facturacion?${params.toString()}`);
  };

  const handleDownloadFile = async (cfdiId: number, format: 'pdf' | 'xml') => {
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/${format}`);
      if (!res.ok) throw new Error(`Error al descargar ${format.toUpperCase()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura_${cfdiId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || `Error al descargar ${format.toUpperCase()}`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* (2026-10-12, decisión del usuario: ya no está «Nueva factura manual» aquí — era un atajo a
          Facturación con el paciente ya elegido; la factura manual se hace en Facturación y se ve abajo, en
          «Otras facturas del paciente».) */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          {titulo}
        </h2>
      </div>

      {/* Borradores SIN tarjeta donde vivir: sin ingreso (el campo es nullable en
          el esquema) o colgados de un ingreso que no es ninguna de estas citas.
          Si no se pintaran aquí serían invisibles, y un borrador invisible
          bloquea crear otro (409) sin dejar cómo descartarlo. */}
      {/* Sin `citas` no hay tarjetas donde repartir los borradores: todos se verían
          "sueltos" aunque cuelguen de una cita. */}
      {verCitas && verFactura && draftsSueltos.length > 0 && (
        <div className="mb-4 space-y-2">
          {draftsSueltos.map((d) => (
            <CfdiDraftRow key={d.id} draft={d} onDiscard={discardDraft} />
          ))}
        </div>
      )}
      {estado === 'cargando' ? (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">Cargando citas…</p>
        </div>
      ) : estado === 'error' ? (
        /* Falló la carga: "no hay citas" sería afirmar un hecho falso. */
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm">No se pudieron cargar las citas. Recarga la página para intentar de nuevo.</p>
        </div>
      ) : !verCitas ? (
        /* Sin `citas` la lista llega vacía A PROPÓSITO: decir "no hay citas" aquí
           afirmaría un hecho falso sobre el paciente. */
        <div className="text-center py-6 text-gray-500">
          <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No tienes permiso para ver las citas de este paciente.</p>
        </div>
      ) : citasVisibles.length > 0 ? (
        <ListaColapsable className="space-y-3">
          {citasVisibles.map((b) => {
            const isCompleted = b.status === 'COMPLETED';
            const drafts = b.ledgerEntryId ? (draftsByEntry.get(b.ledgerEntryId) ?? []) : [];
            return (
              <div key={b.id} className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Top row: date, service, status */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {b.date
                        ? new Date(b.date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                      {b.startTime && ` · ${b.startTime}`}
                      {b.endTime && `–${b.endTime}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.serviceName || '—'}</p>
                    {/* Notas de la cita — contexto clínico que el doctor escribió al
                        agendar ("seguimiento Wegovy") y que hasta hoy no se veía en
                        ninguna pantalla. `trim()`: hay citas con notes = "" y un
                        bloque vacío se lee como un error de carga. */}
                    <NotasCita notes={b.notes} conEtiqueta={false} className="mt-1" />
                    {/* El PAPELEO de un vistazo. Los DOS veredictos —cobro y
                        factura— los resuelve el servidor; aquí no se deduce nada. */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {verCobro && (
                        <PagoBadge estadoPago={b.estadoPago ?? 'SIN_REGISTRO'} metodoPago={b.metodoPago ?? null} />
                      )}
                      {verFactura && (
                        <FacturaBadge
                          facturada={b.facturada === true}
                          solicitada={b.facturaSolicitada === true}
                          cubierta={b.estadoPago === 'CUBIERTA'}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {b.formLinkId && (
                      <Link
                        href={`/dashboard/medical-records/formularios/${b.formLinkId}`}
                        className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        Formulario
                      </Link>
                    )}
                    <BookingStatusPill status={b.status} />
                  </div>
                </div>

                {/* La fila de COBRO (crear/compartir link de Stripe o Mercado Pago)
                    se quitó del expediente a propósito: aquí lo que importa es el
                    ESTADO —pagado o no, y con qué— y eso ya lo dice el chip de
                    arriba. Crear y compartir links sigue viviendo en Mis Citas,
                    que es donde se cobra. */}

                {/* Fila financiera. La condición ya NO es `isCompleted`: el ingreso
                    nace por DOS caminos y el del link de pago no espera a que la
                    cita se complete, así que una cita agendada y ya cobrada
                    mostraba la tarjeta vacía justo cuando había algo que decir. */}
                {/* Con `facturacion` pero sin `flujo` el monto no llega: la fila se
                    ancla entonces al ingreso, y sólo pinta la parte de factura. */}
                {((verCobro && b.amount != null) || (!verCobro && verFactura && b.ledgerEntryId != null)) && (
                  <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                    {/* Monto. La FORMA de pago ya va en el chip "Pagado · Efectivo"
                        de arriba, así que aquí no se repite. */}
                    {verCobro && b.amount != null && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-semibold text-teal-700">{formatCurrency(b.amount)}</span>
                        {/* Un cobro a medias se DICE con su número: el chip solo no
                            deja saber cuánto falta. */}
                        {b.paymentStatus === 'PARTIAL' && b.amountPaid != null && (
                          <span className="text-xs text-amber-700">
                            · cobrado {formatCurrency(b.amountPaid)} de {formatCurrency(b.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Factura: el estado y, si ya está, sus archivos */}
                    {verFactura && (
                    <div className="flex items-center justify-between gap-2">
                      {b.facturada ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-xs text-green-700 font-medium">
                            Facturado{b.cfdi?.folio ? ` · Folio ${b.cfdi.folio}` : ''}
                          </span>
                          {b.cfdi && (
                            <span className="text-xs text-gray-400">
                              {new Date(b.cfdi.issuedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      ) : b.ledgerEntryId && b.amount === 0 ? (
                        /* T6: sesión cubierta por el paquete de un tratamiento — su ingreso es $0 y no
                           se factura (se factura el PAGO del paquete). Sólo se sabe con `flujo`. */
                        <span className="text-xs text-gray-500">No se factura: lo que se factura es el pago del paquete</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`w-4 h-4 ${b.facturaSolicitada ? 'text-orange-500' : 'text-amber-500'}`} />
                          <span className={`text-xs font-medium ${b.facturaSolicitada ? 'text-orange-700' : 'text-amber-700'}`}>
                            {b.facturaSolicitada ? 'Pendiente de facturar' : 'Sin factura'}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {b.cfdi ? (
                          <>
                            <button
                              onClick={() => handleDownloadFile(b.cfdi!.id, 'pdf')}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDownloadFile(b.cfdi!.id, 'xml')}
                              className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              XML
                            </button>
                          </>
                        ) : b.facturada ? null : !b.ledgerEntryId ? (
                          /* Sin ingreso no hay qué facturar (la factura se ancla al
                             ingreso). Antes esto no pintaba NADA y la cita marcada
                             "necesita factura" parecía rota. */
                          <span className="text-xs text-gray-400">Se factura al registrar el cobro</span>
                        ) : b.amount === 0 ? (
                          /* T6: $0 «cubierta por el paquete» — no hay qué facturar en la sesión. */
                          null
                        ) : drafts.length > 0 ? (
                          /* DOS CAMINOS SOBRE EL MISMO INGRESO. Con un borrador vivo,
                             un botón "Facturar" al lado abre el form SIN el borrador
                             (prefill por query params) y, al timbrar, NO lo cierra —
                             cfdi/route.ts solo marca `emitted` si recibe `draftId`.
                             El borrador quedaba huérfano y su botón ya solo podía dar
                             409. Se deja UN camino: el borrador manda, y para ignorarlo
                             está Descartar (y entonces reaparece Facturar). */
                          <span className="text-xs text-blue-700">Hay un borrador preparado ↓</span>
                        ) : !verCobro ? (
                          /* Facturar arma el CFDI con el MONTO del ingreso, que sin
                             `flujo` no llega: el botón no tendría con qué. */
                          null
                        ) : fiscalDataComplete ? (
                          <button
                            onClick={() => handleEmitCfdi(b)}
                            className="text-sm px-3.5 py-2 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Receipt className="w-4 h-4" /> Facturar
                          </button>
                        ) : (
                          /* Faltan datos del receptor: el camino es el formulario
                             fiscal (desde la cita) o capturarlos en Datos Fiscales,
                             arriba en este mismo expediente. Antes decía "Sin datos
                             fiscales" y ahí se acababa. */
                          <span className="text-xs text-gray-500">
                            Faltan datos fiscales —{' '}
                            <a href={hrefDatosFiscales} className="text-blue-600 hover:underline">captúralos</a>
                          </span>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Borradores de ESTA cita (F2c). Viven aquí, no flotando encima
                        de la lista: un borrador cuelga de un ingreso, o sea de una
                        cita concreta. */}
                    {verFactura && drafts.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {drafts.map((d) => (
                          <CfdiDraftRow
                            key={d.id}
                            draft={d}
                            onDiscard={discardDraft}
                            ingresoYaFacturado={b.facturada === true}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Completada sin ingreso: el chip "Sin cobro registrado" de arriba
                    ya lo dice, así que aquí solo queda la vía para facturarla si
                    hiciera falta (sin ingreso no hay a qué anclar la factura). */}
                {verCobro && verFactura && isCompleted && b.amount == null && b.facturaSolicitada && (
                  <div className="px-4 py-2 border-t border-gray-100">
                    <span className="text-xs text-gray-400">Se factura al registrar el cobro</span>
                  </div>
                )}

                {extraPorCita && (
                  <div className="px-4 py-2 border-t border-gray-100">{extraPorCita(b)}</div>
                )}
              </div>
            );
          })}
        </ListaColapsable>
      ) : (
        <div className="text-center py-6 text-gray-500">
          <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm">No hay citas vinculadas a este paciente.</p>
        </div>
      )}

    </div>
  );
}
