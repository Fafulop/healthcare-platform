'use client';

/**
 * PACIENTE MIGRATION I2 — pestaña «Documentos de pacientes» de Importar. Sólo guarda (sin IA):
 * PDF e imágenes → Docs y Galería del paciente; Word (.docx) → una nota con su texto.
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md
 */

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileText, FolderOpen, Image as ImageIcon, Loader2, NotebookPen, Upload, X } from 'lucide-react';
import { VerPlanesLink } from '@/components/layout/VerPlanesLink';
import { MAX_ARCHIVOS } from '@/lib/importar-documentos-emparejar';
import { getClinicDateString } from '@/lib/dates';
import { useImportarDocumentos, type ArchivoElegido, type Fila } from './useImportarDocumentos';

const MB = 1024 * 1024;
const tamano = (b: number) => (b >= 1024 * MB ? `${(b / (1024 * MB)).toFixed(1)} GB` : b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Lee una carpeta soltada (Chrome/Edge): recorre subcarpetas y conserva la ruta. */
async function leerSoltados(items: DataTransferItemList): Promise<ArchivoElegido[]> {
  const out: ArchivoElegido[] = [];
  const recorrer = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile) {
      const f = await new Promise<File>((ok, err) => (e as FileSystemFileEntry).file(ok, err));
      out.push({ file: f, ruta: e.fullPath.replace(/^\//, '') });
    } else if (e.isDirectory) {
      const lector = (e as FileSystemDirectoryEntry).createReader();
      // readEntries devuelve por lotes: hay que pedir hasta que venga vacío.
      for (;;) {
        const lote = await new Promise<FileSystemEntry[]>((ok, err) => lector.readEntries(ok, err));
        if (lote.length === 0) break;
        for (const x of lote) await recorrer(x);
      }
    }
  };
  // Las entradas se toman ANTES de cualquier await: el navegador vacía `items` al terminar el evento.
  const lista = Array.from(items);
  const entradas = lista.map((it) => it.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
  const sueltos = entradas.length ? [] : lista.map((it) => it.getAsFile()).filter((f): f is File => !!f);
  for (const e of entradas) await recorrer(e);
  for (const f of sueltos) out.push({ file: f, ruta: f.name });
  return out;
}

const deInput = (lista: FileList | null): ArchivoElegido[] =>
  Array.from(lista ?? []).map((f) => ({ file: f, ruta: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }));

export function ImportarDocumentos() {
  const imp = useImportarDocumentos();
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivos = useRef<HTMLInputElement>(null);
  const inputCarpeta = useRef<HTMLInputElement>(null);
  const listo = imp.cargaPacientes === 'ok';

  const nombreDe = useMemo(() => {
    const m = new Map(imp.pacientes.map((p) => [p.id, `${p.lastName} ${p.firstName}`.trim() + (p.internalId ? ` (${p.internalId})` : '') + (p.archivado ? ' · archivado' : '')]));
    return (id: string) => m.get(id) ?? '—';
  }, [imp.pacientes]);
  const ordenados = useMemo(() => [...imp.pacientes].sort((a, b) => nombreDe(a.id).localeCompare(nombreDe(b.id), 'es')), [imp.pacientes, nombreDe]);

  // Primero lo que necesita atención (sin paciente, varios posibles, rechazado, error).
  const filas = useMemo(() => {
    const peso = (f: Fila) => (f.estado === 'error' ? 0 : f.rechazo ? 1 : !f.patientId ? 2 : 3);
    return [...imp.filas].sort((a, b) => peso(a) - peso(b));
  }, [imp.filas]);

  const errores = imp.filas.filter((f) => f.estado === 'error').length;
  const guardados = imp.filas.filter((f) => f.estado === 'guardado').length;
  const yaImportados = imp.filas.filter((f) => f.estado === 'ya_importado').length;
  const restante = imp.almacenamiento ? Math.max(imp.almacenamiento.tope - imp.almacenamiento.usado, 0) : null;
  const puedeImportar = imp.fase !== 'importando' && imp.resumen.archivos > 0 && imp.resumen.sinPaciente === 0 && imp.resumen.leyendo === 0 && imp.cabe;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-700 space-y-1">
        <p>Trae los archivos que ya tienes por paciente. <strong>No se leen ni se resumen</strong>; se guardan así:</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li><strong>PDF y fotos (JPG, PNG, WebP)</strong> → al <strong>Docs y Galería</strong> del paciente, como «Historial importado».</li>
          <li><strong>Word (.docx)</strong> → una <strong>nota</strong> del paciente con el texto del documento (las imágenes de adentro no pasan; si importan, guárdalo como PDF).</li>
        </ul>
        <p className="text-gray-500">El paciente se reconoce por el nombre de la carpeta o del archivo (o por su folio). Los pacientes tienen que existir antes: si no, impórtalos primero con la pestaña «Pacientes (Excel)».</p>
      </div>

      {imp.cargaPacientes === 'error' && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">No se pudieron cargar tus pacientes. Recarga la página.</p>
      )}

      {imp.fase !== 'listo' && imp.fase !== 'importando' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={async (e) => { e.preventDefault(); setArrastrando(false); if (listo) imp.agregar(await leerSoltados(e.dataTransfer.items)); }}
          className={`rounded-lg border-2 border-dashed p-6 text-center ${arrastrando ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'}`}
        >
          {!listo ? (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando tus pacientes…</p>
          ) : (
            <>
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-700">Suelta aquí archivos o una carpeta (hasta {MAX_ARCHIVOS} por importación)</p>
              <div className="mt-3 flex justify-center gap-2 flex-wrap">
                <button onClick={() => inputArchivos.current?.click()} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">Elegir archivos</button>
                <button onClick={() => inputCarpeta.current?.click()} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 inline-flex items-center gap-1"><FolderOpen className="w-4 h-4" />Elegir carpeta</button>
              </div>
              <input ref={inputArchivos} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                onChange={(e) => { imp.agregar(deInput(e.target.files)); e.target.value = ''; }} />
              <input ref={inputCarpeta} type="file" multiple className="hidden"
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                onChange={(e) => { imp.agregar(deInput(e.target.files)); e.target.value = ''; }} />
            </>
          )}
        </div>
      )}

      {imp.aviso && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{imp.aviso}</p>}

      {imp.filas.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2">Archivo</th><th className="px-3 py-2">Va como</th><th className="px-3 py-2">Paciente</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((f) => (
                <tr key={f.id} className={f.rechazo || f.estado === 'error' ? 'bg-red-50/40' : ''}>
                  <td className="px-3 py-2 align-top max-w-xs">
                    <p className="font-medium text-gray-900 break-all">{f.nombre}</p>
                    {f.ruta !== f.nombre && <p className="text-xs text-gray-400 break-all">{f.ruta}</p>}
                    <p className="text-xs text-gray-400">{tamano(f.bytes)}</p>
                    {f.word?.estado === 'ok' && <VistaWord texto={f.word.texto} imagenes={f.word.imagenes} />}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {f.tipo === 'pdf' && <span className="inline-flex items-center gap-1 text-gray-700"><FileText className="w-4 h-4" />PDF</span>}
                    {f.tipo === 'imagen' && <span className="inline-flex items-center gap-1 text-gray-700"><ImageIcon className="w-4 h-4" />Imagen</span>}
                    {f.tipo === 'word' && <span className="inline-flex items-center gap-1 text-teal-700"><NotebookPen className="w-4 h-4" />Word → nota</span>}
                  </td>
                  <td className="px-3 py-2 align-top min-w-56">
                    {f.rechazo ? (
                      <p className="text-xs text-red-700">{f.rechazo}</p>
                    ) : f.word?.estado === 'leyendo' ? (
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Leyendo el Word…</p>
                    ) : (
                      <>
                        <select
                          value={f.patientId ?? ''}
                          disabled={f.estado === 'guardado' || f.estado === 'ya_importado' || imp.fase === 'importando'}
                          onChange={(e) => imp.asignarPaciente(f.id, e.target.value || null)}
                          className={`w-full rounded border px-2 py-1 text-sm ${f.patientId ? 'border-gray-300' : 'border-amber-400 bg-amber-50'}`}
                        >
                          <option value="">— Elige el paciente —</option>
                          {f.emparejamiento.estado === 'varios' && (
                            <optgroup label="Posibles (mismo nombre)">
                              {f.emparejamiento.candidatos.map((id) => <option key={`c-${id}`} value={id}>{nombreDe(id)}</option>)}
                            </optgroup>
                          )}
                          <optgroup label="Todos">
                            {ordenados.map((p) => <option key={p.id} value={p.id}>{nombreDe(p.id)}</option>)}
                          </optgroup>
                        </select>
                        {!f.patientId && f.emparejamiento.estado === 'varios' && <p className="mt-0.5 text-xs text-amber-700">Hay varios pacientes con ese nombre: elige uno.</p>}
                        {!f.patientId && f.emparejamiento.estado === 'ninguno' && <p className="mt-0.5 text-xs text-amber-700">No se reconoció el paciente. Al elegirlo, se pone también en los de su carpeta.</p>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {!f.rechazo && (
                      <>
                        <input type="date" value={f.fecha} max={getClinicDateString()} onChange={(e) => e.target.value && imp.cambiarFecha(f.id, e.target.value)}
                          disabled={f.estado === 'guardado' || f.estado === 'ya_importado' || imp.fase === 'importando'}
                          className="rounded border border-gray-300 px-2 py-1 text-sm" />
                        <p className="text-xs text-gray-400">{f.fechaOrigen === 'nombre' ? 'del nombre' : f.fechaOrigen === 'archivo' ? 'del archivo' : 'elegida'}</p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {f.estado === 'guardado' && <span className="text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Guardado</span>}
                    {f.estado === 'ya_importado' && <span className="text-gray-500">Ya estaba importado</span>}
                    {f.estado === 'error' && <span className="text-red-700 text-xs">{f.motivo}</span>}
                    {f.estado === 'pendiente' && imp.fase !== 'importando' && (
                      <button onClick={() => imp.quitar(f.id)} className="text-gray-400 hover:text-gray-700" aria-label="Quitar"><X className="w-4 h-4" /></button>
                    )}
                    {f.estado === 'pendiente' && imp.fase === 'importando' && !f.rechazo && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {imp.filas.length > 0 && imp.fase !== 'listo' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <p className="text-sm text-gray-800">
            <strong>{imp.resumen.archivos}</strong> por importar · <strong>{imp.resumen.pacientes}</strong> pacientes · <strong>{tamano(imp.resumen.bytesASubir)}</strong> por subir
            {restante !== null && <> · te quedan <strong>{tamano(restante)}</strong></>}
            {imp.resumen.rechazados > 0 && <> · <span className="text-red-700">{imp.resumen.rechazados} no se pueden importar</span></>}
          </p>
          {imp.resumen.sinPaciente > 0 && <p className="text-sm text-amber-800 flex items-center gap-1"><AlertTriangle className="w-4 h-4" />{imp.resumen.sinPaciente} sin paciente: elígelo o quítalos.</p>}
          {!imp.cabe && (
            <p className="text-sm text-red-800">No cabe en el espacio de tu plan. Quita archivos o amplía tu plan. <VerPlanesLink /></p>
          )}
          <button onClick={imp.importar} disabled={!puedeImportar}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-40">
            {imp.fase === 'importando' ? <><Loader2 className="w-4 h-4 animate-spin" />Importando… no cierres esta página</> : 'Importar'}
          </button>
        </div>
      )}

      {imp.fase === 'listo' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <p className="text-sm text-gray-800">
            <strong>{guardados}</strong> guardados · <strong>{yaImportados}</strong> ya estaban · {errores > 0 ? <span className="text-red-700"><strong>{errores}</strong> fallaron</span> : '0 fallaron'}
          </p>
          <div className="flex gap-2 flex-wrap">
            {errores > 0 && <button onClick={imp.importar} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Reintentar fallidos</button>}
            <button onClick={imp.empezarOtra} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Importar más</button>
          </div>
          <PacientesImportados filas={imp.filas} nombreDe={nombreDe} />
        </div>
      )}
    </div>
  );
}

function VistaWord({ texto, imagenes }: { texto: string; imagenes: number }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-600">
      <p className="whitespace-pre-wrap">{abierto ? texto : `${texto.slice(0, 300)}${texto.length > 300 ? '…' : ''}`}</p>
      {texto.length > 300 && <button onClick={() => setAbierto(!abierto)} className="mt-1 text-blue-600 hover:underline">{abierto ? 'Ver menos' : 'Ver todo'}</button>}
      {imagenes > 0 && <p className="mt-1 text-amber-700">Tenía {imagenes} {imagenes === 1 ? 'imagen' : 'imágenes'}: no pasan a la nota.</p>}
    </div>
  );
}

function PacientesImportados({ filas, nombreDe }: { filas: Fila[]; nombreDe: (id: string) => string }) {
  const ids = [...new Set(filas.filter((f) => f.estado === 'guardado' && f.patientId).map((f) => f.patientId as string))];
  if (ids.length === 0) return null;
  return (
    <ul className="text-sm space-y-0.5">
      {ids.map((id) => (
        <li key={id}><Link href={`/dashboard/medical-records/patients/${id}`} className="text-blue-600 hover:underline">{nombreDe(id)}</Link></li>
      ))}
    </ul>
  );
}
