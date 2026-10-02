'use client';

/**
 * PACIENTE MIGRATION I2 — la lógica de «Documentos de pacientes»: archivos elegidos → a qué paciente
 * y de qué fecha → subir los PDF/imágenes de 10 en 10 por las rutas de siempre → guardar por tandas en
 * `POST /api/patient-import/documentos`. El Word no se sube: su texto se vuelve nota.
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md §4, §6b.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadFiles } from '@/lib/uploadthing';
import { getClinicDateString } from '@/lib/dates';
import {
  MAX_ARCHIVOS, carpetaDe, clasificarArchivo, emparejar, fechaPropuesta,
  type Emparejamiento, type PacienteParaEmparejar, type TipoImport,
} from '@/lib/importar-documentos-emparejar';
import { leerWord } from '@/lib/importar-documentos-word';

export type EstadoFila = 'pendiente' | 'guardado' | 'ya_importado' | 'error';

export interface Fila {
  id: string;
  file: File;
  ruta: string;
  nombre: string;
  bytes: number;
  tipo: TipoImport | null;
  mime: string;
  /** Rechazado ANTES de importar (tipo, tamaño, Word ilegible…). No se importa. */
  rechazo: string | null;
  word: { estado: 'leyendo' } | { estado: 'ok'; texto: string; imagenes: number } | null;
  emparejamiento: Emparejamiento;
  patientId: string | null;
  fecha: string;
  fechaOrigen: 'nombre' | 'archivo' | 'doctor';
  estado: EstadoFila;
  motivo?: string;
  /** Ya subido (para no volver a subirlo al reintentar). */
  subido?: { url: string };
}

export interface ArchivoElegido { file: File; ruta: string }

const nuevoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const POR_SUBIDA = 10; // maxFileCount de `medicalDocuments` / `medicalImages`
const POR_TANDA = 25; // MAX_POR_TANDA del servidor
const CARACTERES_POR_TANDA = 1_500_000; // las notas largas van en tandas más chicas

export function useImportarDocumentos() {
  const [pacientes, setPacientes] = useState<PacienteParaEmparejar[]>([]);
  const [cargaPacientes, setCargaPacientes] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [almacenamiento, setAlmacenamiento] = useState<{ usado: number; tope: number } | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [fase, setFase] = useState<'elegir' | 'revisar' | 'importando' | 'listo'>('elegir');
  const [aviso, setAviso] = useState<string | null>(null);
  const batchId = useRef(nuevoId());
  const filasRef = useRef<Fila[]>([]);
  filasRef.current = filas;

  // Los pacientes del doctor, ACTIVOS y ARCHIVADOS (G6), y cuánto almacenamiento le queda.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const leer = async (status: string) => {
          const r = await fetch(`/api/medical-records/patients?status=${status}`);
          const d = await r.json().catch(() => null);
          if (!r.ok || !Array.isArray(d?.data)) throw new Error();
          return (d.data as { id: string; firstName: string; lastName: string; internalId: string | null }[])
            .map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, internalId: p.internalId, archivado: status === 'archived' }));
        };
        const [activos, archivados] = await Promise.all([leer('active'), leer('archived')]);
        if (vivo) { setPacientes([...activos, ...archivados]); setCargaPacientes('ok'); }
      } catch {
        if (vivo) setCargaPacientes('error');
      }
      try {
        const r = await fetch('/api/account/summary');
        const d = await r.json().catch(() => null);
        const a = d?.data?.almacenamiento ?? d?.almacenamiento;
        if (vivo && a && typeof a.usadoBytes === 'number' && typeof a.topeBytes === 'number') {
          setAlmacenamiento({ usado: a.usadoBytes, tope: a.topeBytes });
        }
      } catch { /* sin el dato, el servidor de subidas sigue revisando el cupo */ }
    })();
    return () => { vivo = false; };
  }, []);

  // No salir a la mitad de una importación.
  useEffect(() => {
    if (fase !== 'importando') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [fase]);

  const actualizar = useCallback((id: string, cambio: Partial<Fila>) => {
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)));
  }, []);

  const agregar = useCallback((elegidos: ArchivoElegido[]) => {
    setAviso(null);
    const hoy = getClinicDateString();
    const yaHay = new Set(filasRef.current.map((f) => f.ruta));
    const nuevos = elegidos.filter((e) => !yaHay.has(e.ruta));
    const cupo = MAX_ARCHIVOS - filasRef.current.length;
    if (nuevos.length > cupo) setAviso(`Se tomaron ${Math.max(cupo, 0)} de ${nuevos.length}: una importación es de hasta ${MAX_ARCHIVOS} archivos. Haz otra con el resto.`);
    const nuevas: Fila[] = nuevos.slice(0, Math.max(cupo, 0)).map(({ file, ruta }) => {
      const c = clasificarArchivo(file.name, file.size);
      const emp = emparejar(ruta, pacientes);
      const f = fechaPropuesta(ruta, file.lastModified, hoy);
      return {
        id: nuevoId(), file, ruta, nombre: file.name, bytes: file.size,
        tipo: c.ok ? c.tipo : null, mime: c.ok ? c.mime : '', rechazo: c.ok ? null : c.motivo,
        word: c.ok && c.tipo === 'word' ? { estado: 'leyendo' } : null,
        emparejamiento: emp, patientId: emp.estado === 'uno' ? emp.patientId : null,
        fecha: f.fecha, fechaOrigen: f.origen, estado: 'pendiente',
      };
    });
    setFilas((fs) => [...fs, ...nuevas]);
    if (nuevas.length) setFase('revisar');
    // El Word se lee YA (para avisar de los que no se pueden), uno por uno.
    (async () => {
      for (const f of nuevas.filter((x) => x.word)) {
        const r = await leerWord(await f.file.arrayBuffer());
        actualizar(f.id, r.ok ? { word: { estado: 'ok', texto: r.texto, imagenes: r.imagenes } } : { word: null, rechazo: r.motivo });
      }
    })();
  }, [pacientes, actualizar]);

  const quitar = useCallback((id: string) => setFilas((fs) => fs.filter((f) => f.id !== id)), []);

  /** Elegir el paciente de un archivo también lo pone en los de SU carpeta que no tienen uno. */
  const asignarPaciente = useCallback((id: string, patientId: string | null) => {
    setFilas((fs) => {
      const base = fs.find((f) => f.id === id);
      const carpeta = base ? carpetaDe(base.ruta) : '';
      return fs.map((f) => {
        if (f.id === id) return { ...f, patientId };
        if (patientId && carpeta && carpetaDe(f.ruta) === carpeta && !f.patientId && f.estado === 'pendiente') return { ...f, patientId };
        return f;
      });
    });
  }, []);

  const cambiarFecha = useCallback((id: string, fecha: string) => actualizar(id, { fecha, fechaOrigen: 'doctor' }), [actualizar]);

  const importables = useMemo(
    () => filas.filter((f) => !f.rechazo && f.estado !== 'guardado' && f.estado !== 'ya_importado'),
    [filas],
  );
  const resumen = useMemo(() => {
    const aSubir = importables.filter((f) => (f.tipo === 'pdf' || f.tipo === 'imagen') && !f.subido);
    return {
      archivos: importables.length,
      pacientes: new Set(importables.map((f) => f.patientId).filter(Boolean)).size,
      bytesASubir: aSubir.reduce((a, f) => a + f.bytes, 0),
      sinPaciente: importables.filter((f) => !f.patientId).length,
      leyendo: importables.filter((f) => f.word?.estado === 'leyendo').length,
      rechazados: filas.filter((f) => f.rechazo).length,
    };
  }, [importables, filas]);
  const cabe = !almacenamiento || resumen.bytesASubir <= Math.max(almacenamiento.tope - almacenamiento.usado, 0);

  /** Guarda una tanda en el servidor y pinta el resultado de cada fila. */
  const guardar = useCallback(async (tanda: Fila[]) => {
    const elementos = tanda.map((f) => (f.tipo === 'word'
      ? { ref: f.id, tipo: 'nota', patientId: f.patientId, fecha: f.fecha, ruta: f.ruta, fileName: f.nombre, texto: f.word && f.word.estado === 'ok' ? f.word.texto : '' }
      : { ref: f.id, tipo: 'archivo', patientId: f.patientId, fecha: f.fecha, ruta: f.ruta, fileName: f.nombre, fileUrl: f.subido?.url, mimeType: f.mime }));
    try {
      const r = await fetch('/api/patient-import/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batchId.current, elementos }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(d?.data?.resultados)) throw new Error(d?.error || 'No se pudo guardar');
      for (const x of d.data.resultados as { ref: string; estado: EstadoFila; motivo?: string }[]) {
        actualizar(x.ref, { estado: x.estado, motivo: x.motivo });
      }
    } catch (e) {
      for (const f of tanda) actualizar(f.id, { estado: 'error', motivo: e instanceof Error ? e.message : 'No se pudo guardar' });
    }
  }, [actualizar]);

  /**
   * Pregunta al servidor (sólo lectura) cuáles de estos archivos YA están importados a su paciente.
   * Si la pregunta falla, se sube igual: el guardado vuelve a revisar el duplicado (G1).
   */
  const verificar = useCallback(async (grupo: Fila[]): Promise<Set<string>> => {
    if (grupo.length === 0) return new Set();
    try {
      const r = await fetch('/api/patient-import/documentos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batchId.current,
          elementos: grupo.map((f) => ({ ref: f.id, tipo: 'verificar', patientId: f.patientId, fileName: f.nombre, bytes: f.bytes })),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(d?.data?.resultados)) return new Set();
      return new Set((d.data.resultados as { ref: string; estado: string }[]).filter((x) => x.estado === 'ya_importado').map((x) => x.ref));
    } catch {
      return new Set();
    }
  }, []);

  /** Importa lo que falta (la primera vez, o «Reintentar fallidos»: el mismo `batchId`). */
  const importar = useCallback(async () => {
    const lista = filasRef.current.filter((f) => !f.rechazo && f.patientId && f.estado !== 'guardado' && f.estado !== 'ya_importado'
      && !(f.word && f.word.estado === 'leyendo'));
    if (lista.length === 0) return;
    setFase('importando');
    for (const f of lista) actualizar(f.id, { estado: 'pendiente', motivo: undefined });

    // 1. PDF e imágenes: subir de 10 en 10 por las rutas de siempre y guardar cada tanda en cuanto sube (G7).
    for (const [tipo, ruta] of [['pdf', 'medicalDocuments'], ['imagen', 'medicalImages']] as const) {
      const deTipo = lista.filter((f) => f.tipo === tipo);
      for (let i = 0; i < deTipo.length; i += POR_SUBIDA) {
        let grupo = deTipo.slice(i, i + POR_SUBIDA).map((f) => filasRef.current.find((x) => x.id === f.id) ?? f);
        // ANTES de subir: ¿ya está importado? (si no, re-importar lo mismo subiría copias que gastan cupo).
        const yaEstan = await verificar(grupo.filter((f) => !f.subido));
        for (const id of yaEstan) actualizar(id, { estado: 'ya_importado', motivo: undefined });
        grupo = grupo.filter((f) => !yaEstan.has(f.id));
        const urls = new Map(grupo.filter((f) => f.subido).map((f) => [f.id, f.subido!.url]));
        const porSubir = grupo.filter((f) => !f.subido);
        if (porSubir.length) {
          try {
            const subidos = await uploadFiles(ruta, { files: porSubir.map((f) => f.file) });
            // Se empata cada resultado con SU archivo por nombre y tamaño (no por posición).
            const libres = [...subidos];
            for (const f of porSubir) {
              const k = libres.findIndex((s) => s.name === f.file.name && s.size === f.file.size);
              const s = k >= 0 ? libres.splice(k, 1)[0] : undefined;
              if (s?.ufsUrl) { urls.set(f.id, s.ufsUrl); actualizar(f.id, { subido: { url: s.ufsUrl } }); }
            }
          } catch (e) {
            const motivo = e instanceof Error && e.message ? e.message : 'No se pudo subir';
            for (const f of porSubir) actualizar(f.id, { estado: 'error', motivo });
            continue;
          }
        }
        const listos = grupo.filter((f) => urls.has(f.id)).map((f) => ({ ...f, subido: { url: urls.get(f.id)! } }));
        for (const f of grupo.filter((x) => !urls.has(x.id))) actualizar(f.id, { estado: 'error', motivo: 'No se pudo subir' });
        if (listos.length) await guardar(listos);
      }
    }

    // 2. Notas (Word): por tandas de hasta 25 y ~1.5 M caracteres.
    const notas = lista.filter((f) => f.tipo === 'word' && f.word?.estado === 'ok');
    let tanda: Fila[] = [];
    let chars = 0;
    for (const f of notas) {
      const n = f.word && f.word.estado === 'ok' ? f.word.texto.length : 0;
      if (tanda.length && (tanda.length >= POR_TANDA || chars + n > CARACTERES_POR_TANDA)) { await guardar(tanda); tanda = []; chars = 0; }
      tanda.push(f); chars += n;
    }
    if (tanda.length) await guardar(tanda);
    setFase('listo');
  }, [actualizar, guardar, verificar]);

  const empezarOtra = useCallback(() => {
    setFilas([]); setFase('elegir'); setAviso(null); batchId.current = nuevoId();
  }, []);

  return {
    pacientes, cargaPacientes, almacenamiento, filas, fase, aviso, resumen, cabe,
    agregar, quitar, asignarPaciente, cambiarFecha, importar, empezarOtra,
  };
}
