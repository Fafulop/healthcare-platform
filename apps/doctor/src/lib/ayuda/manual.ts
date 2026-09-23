/**
 * Carga `manual-del-doctor.md` — la fuente única del widget — y saca de él la lista de
 * secciones citables («Agenda > Reagendar una cita»).
 *
 * Se lee del disco (no se importa) para que el manual siga siendo un .md greppable y
 * diffeable, sin un paso de build. `next start` corre con el árbol fuente presente, pero
 * el directorio de trabajo depende de cómo se lance: desde `apps/doctor` o desde la raíz
 * del monorepo. Se prueban las dos.
 *
 * 🔴 Si no se encuentra, TRUENA. Un manual vacío no es "no hay nada que decir": el modelo
 * contestaría "no lo sé" a todo con total seguridad, y nadie se enteraría de que el
 * archivo no llegó al servidor.
 */

import fs from 'fs';
import path from 'path';

const CANDIDATOS = [
  path.join(process.cwd(), 'src/lib/ayuda/manual-del-doctor.md'),
  path.join(process.cwd(), 'apps/doctor/src/lib/ayuda/manual-del-doctor.md'),
];

export interface Manual {
  texto: string;
  /** "Área > Sección" de cada `###` bajo su `##`, en orden. */
  secciones: string[];
}

let cache: Manual | null = null;

export function cargarManual(): Manual {
  if (cache) return cache;
  const ruta = CANDIDATOS.find((p) => fs.existsSync(p));
  if (!ruta) {
    throw new Error(`manual-del-doctor.md no encontrado (buscado en: ${CANDIDATOS.join(' · ')})`);
  }
  // El comentario HTML de arriba son instrucciones para quien EDITA el manual, no para el
  // doctor: no le sirve al modelo y sólo cuesta tokens.
  const texto = fs.readFileSync(ruta, 'utf-8').replace(/<!--[\s\S]*?-->/g, '').trim();
  cache = { texto, secciones: extraerSecciones(texto) };
  return cache;
}

export function extraerSecciones(texto: string): string[] {
  const secciones: string[] = [];
  let area: string | null = null;
  // `\r?\n`: con core.autocrlf en Windows el .md llega con CRLF, y `(.+)$` no casa con un
  // `\r` al final — `secciones` quedaba vacío y TODA cita se tiraba como inventada.
  for (const linea of texto.split(/\r?\n/)) {
    const h2 = /^## (.+)$/.exec(linea);
    if (h2) {
      area = h2[1].trim();
      continue;
    }
    const h3 = /^### (.+)$/.exec(linea);
    if (h3 && area) secciones.push(`${area} > ${h3[1].trim()}`);
  }
  return secciones;
}
