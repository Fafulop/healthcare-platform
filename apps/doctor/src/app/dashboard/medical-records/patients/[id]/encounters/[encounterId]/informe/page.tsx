'use client';

/**
 * INFORME MÉDICO — la pantalla del doctor (paso 5 de 02-PLAN §6).
 *
 * 🔴 El PDF es una SALIDA, nunca la superficie de captura: aquí se teclea contra
 * el JSON de respuestas y el PDF se genera al final. Por eso el borrador que se
 * descarga es de SÓLO LECTURA — si el doctor tecleara en el PDF, ese valor
 * viviría sólo en ese archivo y desaparecería al regenerarlo (02-PLAN §4b).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, Loader2, AlertTriangle, ShieldCheck, Save, X } from 'lucide-react';
import InformeVisor, { type ValorVisor } from './InformeVisor';
import type { ResultadoDictado } from './DictadoPagina';
import { caracteresNoImprimibles } from '@/lib/informe-medico/winansi';

interface Formato { id: string; insurer: string; name: string; version: string }
interface Valor { value: string; source: string | null; origin: string }
interface Campo { clave: string; etiqueta: string; valor: Valor }
interface Informe {
  id: string; status: string; consentGiven: boolean; issuedAt: string | null;
  form: Formato;
}
type Aviso = { tipo: string; [k: string]: unknown };

/** El color dice de dónde salió el valor: el doctor revisa con los ojos donde
 * hay riesgo, no los 40 campos por igual (01-FUENTES §4). */
const ESTILO_ORIGEN: Record<string, { chip: string; texto: string }> = {
  deterministic: { chip: 'bg-green-100 text-green-800', texto: 'del expediente' },
  manual: { chip: 'bg-blue-100 text-blue-800', texto: 'lo escribiste tú' },
  llm: { chip: 'bg-amber-100 text-amber-900', texto: 'lo redactó la IA — revísalo' },
  voice: { chip: 'bg-amber-100 text-amber-900', texto: 'dictado — revísalo' },
  empty: { chip: 'bg-gray-100 text-gray-600', texto: 'sin dato en el expediente' },
};

function textoAviso(a: Aviso): string {
  switch (a.tipo) {
    case 'apellido-heuristico':
      return `El apellido se partió a ojo: "${a.paterno}" / "${a.materno}". Corrígelo si está mal — el expediente los guarda juntos.`;
    case 'apellido-unico':
      return `"${a.lastName}" es un solo apellido: el materno quedó vacío.`;
    case 'sexo-desconocido':
      return `El sexo del paciente ("${a.valor}") no es masculino/femenino/otro, así que se dejó vacío.`;
    case 'medicamentos-truncados':
      return `Hay ${a.total} medicamentos recetados y en la hoja caben ${a.escritos}. Los demás hay que anexarlos aparte.`;
    default:
      return JSON.stringify(a);
  }
}

export default function InformeMedicoPage() {
  const params = useParams<{ id: string; encounterId: string }>();
  const patientId = params.id;
  const encounterId = params.encounterId;

  const [formatos, setFormatos] = useState<Formato[]>([]);
  const [formatoElegido, setFormatoElegido] = useState('');
  const [informe, setInforme] = useState<Informe | null>(null);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  /**
   * 🔴 LO PENDIENTE: editado y **todavía NO guardado**.
   *
   * Decisión 1B (06-AGENTE §10): en esta pantalla **nada se persiste hasta que
   * el doctor aprieta Guardar**. Antes cada campo hacía `PATCH` al salir; con el
   * agente proponiendo valores encima, dos cajas idénticas se habrían comportado
   * distinto —una guardada y otra no— sin forma de saber cuál era cuál.
   *
   * El precio: se puede perder trabajo al cerrar la pestaña ⇒ el aviso de abajo.
   * Se descartó respaldarlo en `localStorage`: no se mete texto clínico del
   * paciente en el navegador sin decidirlo a propósito.
   */
  const [pendientes, setPendientes] = useState<Record<string, ValorVisor>>({});
  /** El VISOR es la vista principal: es el formato real con las cajas encima.
   * La lista se queda como red — si el render del PDF falla en algún navegador,
   * el doctor todavía puede llenar y emitir. */
  const [vista, setVista] = useState<'visor' | 'lista'>('visor');

  const base = `/api/medical-records/patients/${patientId}/reports`;

  /** El error de una respuesta que puede NO ser JSON (login HTML, proxy 502). */
  async function mensajeDeRespuesta(r: Response, porDefecto: string): Promise<string> {
    if (r.status === 401) return 'Se venció la sesión. Vuelve a entrar.';
    try {
      if (r.headers.get('content-type')?.includes('application/json')) {
        return ((await r.json()) as { error?: string }).error ?? porDefecto;
      }
    } catch { /* cae al mensaje por defecto */ }
    return porDefecto;
  }

  const abrirInforme = useCallback(async (id: string) => {
    const r = await fetch(`${base}/${id}`);
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? 'No se pudo abrir el informe'); return; }
    setInforme(d.report);
    setCampos(d.campos);
    // Los avisos vienen del servidor recalculados, así que sobreviven a una
    // recarga. Antes sólo existían en la respuesta del POST.
    setAvisos(d.avisos ?? []);
    // Lo no guardado se descarta: a partir de aquí manda lo del servidor.
    setPendientes({});
  }, [base]);

  // 🔴 El precio de 1B: si se cierra la pestaña con cambios sin guardar, se
  // pierden. Al menos hay que avisar.
  useEffect(() => {
    if (Object.keys(pendientes).length === 0) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendientes]);

  useEffect(() => {
    (async () => {
      try {
        const [rf, rr] = await Promise.all([
          fetch('/api/medical-records/insurance-forms'),
          fetch(`${base}?encounterId=${encounterId}`),
        ]);
        const df = await rf.json();
        const dr = await rr.json();
        if (rf.ok) { setFormatos(df.forms ?? []); setFormatoElegido(df.forms?.[0]?.id ?? ''); }
        if (rr.ok && dr.reports?.length) await abrirInforme(dr.reports[0].id);
      } catch {
        setError('No se pudo cargar la pantalla.');
      } finally {
        setCargando(false);
      }
    })();
  }, [base, encounterId, abrirInforme]);

  async function generar() {
    setTrabajando(true); setError(null);
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encounterId, formId: formatoElegido }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'No se pudo generar'); return; }
      setAvisos(d.avisos ?? []);
      await abrirInforme(d.report.id);
    } finally { setTrabajando(false); }
  }

  /** Anota una edición como PENDIENTE. No toca el servidor (decisión 1B). */
  function editarCampo(clave: string, value: string) {
    const guardadoActual = campos.find((c) => c.clave === clave)?.valor;
    setPendientes((p) => {
      const n = { ...p };
      // Si vuelve a ser igual a lo guardado deja de estar pendiente: el contador
      // no debe decir "1 sin guardar" de un campo que se devolvió a su valor.
      if ((guardadoActual?.value ?? '') === value) delete n[clave];
      else n[clave] = { value, origin: value.trim() === '' ? 'empty' : 'manual' };
      return n;
    });
  }

  /** Descarta UN pendiente: el campo vuelve a como está guardado (2B). */
  function descartarCampo(clave: string) {
    setPendientes((p) => { const n = { ...p }; delete n[clave]; return n; });
  }

  /** Descarta TODO lo pendiente, para que una tanda mala del agente no haya que
   * deshacerla campo por campo. */
  function descartarTodo() {
    setPendientes({});
  }

  /** Guarda TODO lo pendiente de una sola vez. Es la ÚNICA escritura. */
  async function guardarTodo(): Promise<boolean> {
    if (!informe || Object.keys(pendientes).length === 0) return true;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch(`${base}/${informe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: pendientes }),
      });
      if (!r.ok) { setError(await mensajeDeRespuesta(r, 'No se pudo guardar')); return false; }
      // Sólo si pasó: `abrirInforme` limpia los pendientes.
      await abrirInforme(informe.id);
      return true;
    } finally {
      setGuardando(false);
    }
  }

  /**
   * El mismo aviso que da el visor, para que las dos pestañas digan lo mismo.
   * Aquí no se conoce la geometría de la caja, así que sólo se puede comprobar
   * lo que no depende del tamaño: los caracteres que el formato no imprime.
   */
  function avisoDeImpresion(c: Campo): string | null {
    // 🔴 Sobre lo que el usuario VE, no sobre lo último confirmado por el
    // servidor: si no, el aviso llega un guardado tarde (se teclea `β` y no
    // aparece hasta el blur) y se queda pegado tras corregirlo. Y si el PATCH
    // falla, la caja conserva el texto malo SIN aviso.
    const texto = pendientes[c.clave]?.value ?? c.valor.value;
    const malos = caracteresNoImprimibles(texto);
    if (malos.length === 0) return null;
    return `El formato no puede imprimir ${malos.map((m) => `"${m}"`).join(' ')} — saldría vacío.`;
  }

  /** Lo que el visor pinta: lo GUARDADO con lo PENDIENTE encima. */
  const valoresVisor: Record<string, ValorVisor> = {
    ...Object.fromEntries(campos.map((c) => [c.clave, { value: c.valor.value, origin: c.valor.origin }])),
    ...pendientes,
  };
  const sinGuardar = Object.keys(pendientes).length;

  /**
   * El dictado: manda la transcripción y RELEE el informe, porque el servidor
   * escribió directo en las respuestas (05-VOZ §4). Devuelve el resumen para que
   * la página pueda decir qué se llenó y qué se descartó.
   */
  async function dictar(audio: Blob, pagina: number | null): Promise<{ r: ResultadoDictado | null; mensaje?: string }> {
    if (!informe) return { r: null, mensaje: 'No hay informe abierto' };
    setError(null);
    const fd = new FormData();
    fd.append('audio', audio, 'dictado.webm');
    if (pagina !== null) fd.append('pagina', String(pagina));
    const r = await fetch(`${base}/${informe.id}/dictar`, { method: 'POST', body: fd });
    if (!r.ok) {
      // 🔴 `r.json()` ANTES del `r.ok` reventaba con las respuestas que no son
      // JSON: un 401 devuelve el HTML del login y un 502 el del proxy.
      const mensaje = await mensajeDeRespuesta(r, 'No se pudo procesar el dictado');
      setError(mensaje);
      return { r: null, mensaje };
    }
    const d = await r.json();
    // El dictado PROPONE: los valores entran como PENDIENTES sobre la hoja y no
    // se guardan hasta que el doctor aprieta Guardar (1B). Nada de releer: el
    // servidor no escribió nada.
    if (d.valores && typeof d.valores === 'object') {
      setPendientes((p) => ({ ...p, ...(d.valores as Record<string, ValorVisor>) }));
    }
    return { r: d as ResultadoDictado };
  }

  function nuevoInforme() {
    setInforme(null); setCampos([]); setAvisos([]); setPendientes({}); setError(null);
  }

  async function cambiarConsentimiento(dado: boolean) {
    if (!informe) return;
    const r = await fetch(`${base}/${informe.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentGiven: dado }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? 'No se pudo registrar el consentimiento'); return; }
    setInforme({ ...informe, consentGiven: d.report.consentGiven });
  }

  async function emitir() {
    if (!informe) return;
    setTrabajando(true); setError(null);
    try {
      const r = await fetch(`${base}/${informe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'issued' }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'No se pudo emitir'); return; }
      setInforme({ ...informe, status: d.report.status, issuedAt: d.report.issuedAt });
    } finally { setTrabajando(false); }
  }

  function descargar(tipo: 'borrador' | 'final') {
    if (!informe) return;
    window.open(`${base}/${informe.id}/pdf?tipo=${tipo}`, '_blank');
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  const emitido = informe?.status === 'issued';
  const llenos = campos.filter((c) => c.valor.value.trim() !== '').length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/dashboard/medical-records/patients/${patientId}/encounters/${encounterId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la consulta
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" /> Informe para la aseguradora
        </h1>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
        )}

        {!informe && (
          <div className="mt-6 bg-white rounded-lg border p-5">
            {formatos.length === 0 ? (
              <p className="text-sm text-gray-600">
                No hay formatos dados de alta todavía.
              </p>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-2">Formato</label>
                <select
                  value={formatoElegido}
                  onChange={(e) => setFormatoElegido(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {formatos.map((f) => (
                    <option key={f.id} value={f.id}>{f.insurer} — {f.name} ({f.version})</option>
                  ))}
                </select>
                <button
                  onClick={generar}
                  disabled={trabajando || !formatoElegido}
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {trabajando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Pre-llenar con el expediente
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Se copia lo que ya está en la ficha y en esta consulta. Nada se inventa: lo que no
                  exista se queda vacío y marcado.
                </p>
              </>
            )}
          </div>
        )}

        {avisos.length > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" /> Revisa esto antes de emitir
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-900 list-disc pl-5">
              {avisos.map((a, i) => <li key={i}>{textoAviso(a)}</li>)}
            </ul>
          </div>
        )}

        {informe && (
          <>
            <div className="mt-4 bg-white rounded-lg border p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {informe.form.insurer} — {informe.form.name}
                </p>
                <p className="text-gray-500 text-xs">
                  versión {informe.form.version} · {llenos} de {campos.length} campos con contenido
                  {emitido && ' · EMITIDO'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => descargar('borrador')}
                  className="inline-flex items-center gap-2 border px-3 py-2 rounded-lg text-sm"
                >
                  <Download className="h-4 w-4" /> Borrador
                </button>
                <button
                  onClick={() => descargar('final')}
                  disabled={!informe.consentGiven}
                  title={informe.consentGiven ? '' : 'Falta registrar el consentimiento'}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-40"
                >
                  <Download className="h-4 w-4" /> Final
                </button>
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              El borrador es de <strong>sólo lectura</strong> a propósito: se edita aquí, no en el
              PDF. Azul = puedes escribir, verde = ya tiene contenido.
            </p>

            <div className="mt-4 bg-white rounded-lg border p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={informe.consentGiven}
                  disabled={emitido}
                  onChange={(e) => cambiarConsentimiento(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-900 flex items-center gap-1">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    El paciente autorizó enviar estos datos a su aseguradora
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Mandar datos clínicos a una aseguradora es una transferencia a un tercero bajo la
                    LFPDPPP. Sin esto no se genera el informe final.
                  </span>
                </span>
              </label>
            </div>

            {sinGuardar > 0 && !emitido && (
              <div className="mt-4 sticky top-2 z-20 flex items-center justify-between gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-2 shadow">
                <span className="text-sm text-amber-900">
                  <strong>{sinGuardar}</strong> campo(s) sin guardar. Nada se manda a la aseguradora
                  hasta que guardes.
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <button onClick={descartarTodo} disabled={guardando} className="text-xs underline text-gray-600 disabled:opacity-50">
                    descartar todo
                  </button>
                  <button
                    onClick={guardarTodo}
                    disabled={guardando}
                    className="inline-flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                  </button>
                </span>
              </div>
            )}

            <div className="mt-4 flex gap-1 border-b">
              {([['visor', 'Formato de la aseguradora'], ['lista', 'Lista de campos']] as const).map(([v, t]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                    vista === v ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {vista === 'visor' && (
              <div className="mt-4 bg-gray-100 rounded-lg border p-4 overflow-x-auto">
                <InformeVisor
                  formId={informe.form.id}
                  valores={valoresVisor}
                  soloLectura={emitido}
                  onEditar={editarCampo}
                  onDescartar={descartarCampo}
                  pendientes={new Set(Object.keys(pendientes))}
                  onDictar={dictar}
                />
              </div>
            )}

            {vista === 'lista' && (
            <div className="mt-4 bg-white rounded-lg border divide-y">
              {campos.map((c) => {
                const estilo = ESTILO_ORIGEN[c.valor.origin] ?? ESTILO_ORIGEN.empty;
                const aviso = avisoDeImpresion(c);
                return (
                  <div key={c.clave} className="p-3 sm:flex sm:items-center sm:gap-4">
                    <div className="sm:w-1/3">
                      <p className="text-sm font-medium text-gray-800">{c.etiqueta}</p>
                      <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded ${estilo.chip}`}>
                        {estilo.texto}
                      </span>
                    </div>
                    <div className="sm:flex-1 mt-2 sm:mt-0">
                      <div className="flex items-center gap-2">
                        <input
                          value={pendientes[c.clave]?.value ?? c.valor.value}
                          disabled={emitido}
                          onChange={(e) => editarCampo(c.clave, e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 ${
                            pendientes[c.clave] ? 'border-amber-400 bg-amber-50' : ''
                          }`}
                          placeholder="—"
                        />
                        {pendientes[c.clave] && !emitido && (
                          <button
                            onClick={() => descartarCampo(c.clave)}
                            title="Descartar este cambio y volver a lo guardado"
                            className="text-gray-400 hover:text-red-600 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {pendientes[c.clave] && (
                        <span className="text-[11px] text-amber-700">sin guardar</span>
                      )}
                      {aviso && <span className="block text-[11px] text-red-700 mt-0.5">{aviso}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {emitido && (
              <div className="mt-4 rounded-lg bg-gray-100 border p-4 text-sm">
                <p className="text-gray-800">
                  Este informe ya fue emitido, así que no se puede editar: la aseguradora ya tiene su
                  copia y cambiarlo aquí las dejaría diciendo cosas distintas.
                </p>
                <button onClick={nuevoInforme} className="mt-3 border bg-white px-3 py-2 rounded-lg text-sm font-medium">
                  Generar un informe nuevo para esta consulta
                </button>
              </div>
            )}

            {!emitido && (
              <button
                onClick={emitir}
                disabled={trabajando || !informe.consentGiven}
                className="mt-4 inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {trabajando && <Loader2 className="h-4 w-4 animate-spin" />}
                Marcar como emitido
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
