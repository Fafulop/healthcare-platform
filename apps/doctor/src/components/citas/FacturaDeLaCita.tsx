'use client';

import { useState } from 'react';
import { Download, MessageCircle, Receipt, Send, Share2 } from 'lucide-react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { faltaCorreo, type ContactoEnvio } from './enviar-enlace';
import { BotonCita, COLUMNA, FilaCita } from './fila-cita';
import { compartirArchivo, descargarBlob } from './compartir-archivo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

async function bajarCfdi(cfdiId: number, formato: 'pdf' | 'xml'): Promise<Blob> {
  const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/${formato}`);
  if (!res.ok) throw new Error();
  return res.blob();
}

/**
 * 2026-10-12 (pedido del usuario) — la FACTURA de la cita desde su tarjeta (agenda, visita, «Cobros»): la fila
 * «Factura» con Correo (la manda Facturama al correo del paciente, como en Facturación) · WhatsApp (el
 * «Compartir» del equipo con el PDF adjunto — WhatsApp no recibe archivos por enlace y el PDF NO se publica
 * en internet; decisión del usuario, opción A) · PDF · XML. WhatsApp va en DOS pasos: primero se prepara el
 * PDF y el botón pasa a «Compartir», que abre el «Compartir» al instante (el navegador sólo deja compartir
 * justo después de un clic). Sin una factura de la plataforma se dice dónde verla.
 */
export function FacturaDeLaCita({ cfdiId, cfdiStatus, folio, contacto, facturada = true, motivo, facturarHref }: {
  cfdiId: number | null | undefined;
  /** ¿Ya está facturada? Sin factura todavía la fila queda en su lugar, gris («Aún no se emite»). */
  facturada?: boolean;
  /** No aplica (sin permiso de Facturación, cita cancelada…): gris con este porqué. */
  motivo?: string | null;
  /** VISITAS 11-PLAN — sólo en la visita, y sólo si el servidor dice que hay algo por facturar en ella: el
   *  botón verde «Facturar» lleva a Facturación con la cita y las ventas de la visita prellenadas. */
  facturarHref?: string | null;
  cfdiStatus?: string | null;
  /** Serie-folio: el archivo se llama como la factura que ve el doctor, no con un número interno. */
  folio?: string | null;
  contacto: ContactoEnvio;
}) {
  const [ocupado, setOcupado] = useState<null | 'correo' | 'wa' | 'pdf' | 'xml'>(null);
  // El PDF preparado es de ESTA factura: si cambia (se canceló y se re-emitió), se tira.
  const [listo, setListo] = useState<{ cfdiId: number; archivo: File } | null>(null);
  const archivoListo = listo && listo.cfdiId === cfdiId ? listo.archivo : null;

  const nombre = (ext: string) => `factura_${(folio || String(cfdiId)).replace(/[^\w-]/g, '')}.${ext}`;

  const descargar = async (formato: 'pdf' | 'xml') => {
    if (!cfdiId) return;
    setOcupado(formato);
    try {
      descargarBlob(await bajarCfdi(cfdiId, formato), nombre(formato));
    } catch {
      toast.error(`No se pudo descargar el ${formato.toUpperCase()}`);
    } finally {
      setOcupado(null);
    }
  };

  const porCorreo = async () => {
    if (!cfdiId) return;
    setOcupado('correo');
    try {
      const res = await authFetch(`${API_URL}/api/facturacion/cfdi/${cfdiId}/email`, {
        method: 'POST', body: JSON.stringify({ email: contacto.email }),
      });
      const d = await res.json().catch(() => null);
      // La ruta contesta 200 con `data.sent` — que Facturama lo haya mandado de verdad (code review).
      if (res.ok && d?.data?.sent === true) toast.success(`Se envió la factura a ${contacto.email}`);
      else toast.error(d?.data?.message || d?.error || 'No se pudo enviar la factura');
    } catch {
      toast.error('No se pudo enviar la factura');
    } finally {
      setOcupado(null);
    }
  };

  const preparar = async () => {
    if (!cfdiId) return;
    setOcupado('wa');
    try {
      setListo({ cfdiId, archivo: new File([await bajarCfdi(cfdiId, 'pdf')], nombre('pdf'), { type: 'application/pdf' }) });
    } catch {
      toast.error('No se pudo preparar la factura');
    } finally {
      setOcupado(null);
    }
  };

  // 2026-10-12 — UNA fila: Correo · WhatsApp · PDF · XML, el estado en palabras. Facturada fuera de la
  // plataforma (subida a mano, del SAT, otro tipo de CFDI): no se afirma de dónde — se dice dónde verla.
  const noSePuede = motivo
    ?? (!facturada ? 'Aún no se emite la factura de esta cita'
      : !cfdiId ? 'Su factura no se emitió desde aquí: se ve en Facturación'
      : null);
  const estado = motivo ? 'No aplica'
    : !facturada ? 'Aún no se emite'
    : !cfdiId ? 'Facturada · se ve en Facturación'
    : `${folio ? `Folio ${folio}` : 'Emitida'}${cfdiStatus === 'cancellation_pending' ? ' · cancelación en proceso' : ''}`;
  // «Facturar» (la visita): quien lo pasa ya sabe —por el servidor— que hay algo por facturar en la visita (la
  // cita o sus ventas). NO depende del estado de la cita (code review): con la cita cancelada o «No asistió»,
  // las ventas pagadas de la visita se siguen facturando desde aquí.
  const facturar = facturarHref ? (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span>{estado}</span>
      <BotonCita
        etiqueta={facturada ? 'Facturar ventas' : 'Facturar'} icono={<Receipt className="w-3 h-3" />} variante="verde"
        href={facturarHref} misma titulo="Abre Facturación con la cita y las ventas de esta visita ya llenas"
      />
    </span>
  ) : null;
  return (
    <FilaCita nombre="Factura" estado={facturar ?? estado} tono={facturar ? 'neutro' : noSePuede ? 'apagado' : cfdiStatus === 'cancellation_pending' ? 'espera' : 'bien'}>
      <BotonCita
        etiqueta="Correo" icono={<Send className="w-3 h-3" />} onClick={porCorreo} ocupado={ocupado === 'correo'}
        motivo={noSePuede ?? (!contacto.email ? faltaCorreo(contacto.expediente) : null)} ancho={COLUMNA.correo}
        irA={!noSePuede && !contacto.email ? contacto.expediente : null}
      />
      {/* WhatsApp en DOS pasos: preparar el PDF y luego «Compartir» (el navegador sólo deja compartir justo
          después de un clic). */}
      {archivoListo ? (
        <BotonCita
          etiqueta="Compartir" icono={<Share2 className="w-3 h-3" />} variante="principal" ancho={COLUMNA.whatsapp}
          onClick={() => { void compartirArchivo(archivoListo); }}
          titulo="Abre el «Compartir» de tu equipo con el PDF: elige WhatsApp y el chat del paciente"
        />
      ) : (
        <BotonCita
          etiqueta="WhatsApp" icono={<MessageCircle className="w-3 h-3" />} onClick={preparar} ocupado={ocupado === 'wa'}
          motivo={noSePuede} ancho={COLUMNA.whatsapp}
          titulo="Prepara el PDF; luego «Compartir» abre el «Compartir» de tu equipo (elige WhatsApp)"
        />
      )}
      <BotonCita
        etiqueta="PDF" icono={<Download className="w-3 h-3" />} onClick={() => descargar('pdf')} ocupado={ocupado === 'pdf'}
        motivo={noSePuede} ancho={COLUMNA.ver}
      />
      <BotonCita
        etiqueta="XML" onClick={() => descargar('xml')} ocupado={ocupado === 'xml'} motivo={noSePuede} ancho={COLUMNA.extra}
      />
    </FilaCita>
  );
}
