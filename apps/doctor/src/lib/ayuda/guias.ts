/**
 * Ayuda H3 (2026-10-05): la pestaña «Flujos» — las guías paso a paso que salieron de la pasada de
 * pruebas (`docs/DESDE JUNIO/PRUEBAS Y GUIAS/`). Cada archivo de `guias/` es una guía; un archivo nuevo
 * ahí = una guía nueva en la página, sin tocar código. Su nombre es su id y su ancla:
 * `/dashboard/ayuda?tab=flujos#a6-a7-completar-una-cita`.
 *
 * La línea «QA (interno…)» de cada guía es la bitácora de su prueba: se queda en el archivo pero se
 * quita AQUÍ, en el servidor — nunca llega al navegador (`scripts/ayuda-guias-check.ts` lo comprueba).
 * Igual «Video: (pendiente)»: el lugar del video aparece cuando haya video.
 *
 * Se lee del disco como el manual (`manual.ts`): un .md greppable, sin paso de build.
 */
import fs from 'fs';
import path from 'path';
import { Marked, type Tokens } from 'marked';
import type { PestanaManual } from './manual-html';

const CANDIDATOS = [
  path.join(process.cwd(), 'src/lib/ayuda/guias'),
  path.join(process.cwd(), 'apps/doctor/src/lib/ayuda/guias'),
];

/** Los grupos de la pestaña, en este orden: la letra del catálogo de flujos → su nombre. */
const GRUPOS: { letra: string; titulo: string }[] = [
  { letra: 'A', titulo: 'Agenda' },
  { letra: 'E', titulo: 'Expediente' },
  { letra: 'T', titulo: 'Tratamientos' },
];

export const PESTANA_FLUJOS = 'flujos';

export interface Guia {
  /** El nombre del archivo sin `.md`, en minúsculas: `a6-a7-completar-una-cita`. */
  id: string;
  grupo: string;
  titulo: string;
  /** El Markdown YA limpio (sin la línea de QA, sin «Video: (pendiente)», sin `---`). */
  md: string;
}

/** «A10-reagendar…» → ['A', 10, '…'] para ordenar A1 < A3 < A10 (no como texto: A10 < A3). */
function claveDeOrden(nombre: string): [string, number, string] {
  const m = /^([A-Z])(\d+)([a-z]?)/.exec(nombre);
  return m ? [m[1], Number(m[2]), m[3]] : [nombre, 0, ''];
}

/** Lo que el doctor NO debe ver: la bitácora de prueba, el video aún sin grabar y los separadores. */
export function limpiarGuia(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !l.startsWith('**QA (interno') && !/^\*\*Video:\*\*\s*\(pendiente\)\s*$/.test(l) && l.trim() !== '---')
    .join('\n')
    .trim();
}

let cache: Guia[] | null = null;

export function cargarGuias(): Guia[] {
  if (cache) return cache;
  const dir = CANDIDATOS.find((p) => fs.existsSync(p));
  // Sin guías NO se truena (a diferencia del manual): la pestaña simplemente no aparece.
  if (!dir) return (cache = []);
  const guias: Guia[] = [];
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
    .sort((a, b) => {
      const [la, na, sa] = claveDeOrden(a);
      const [lb, nb, sb] = claveDeOrden(b);
      return la.localeCompare(lb) || na - nb || sa.localeCompare(sb) || a.localeCompare(b);
    });
  for (const f of archivos) {
    const grupo = GRUPOS.find((g) => f.startsWith(g.letra));
    if (!grupo) continue;
    const md = limpiarGuia(fs.readFileSync(path.join(dir, f), 'utf-8'));
    const titulo = /^#\s+(.+?)\s*$/m.exec(md)?.[1] ?? f.replace(/\.md$/, '');
    guias.push({ id: f.replace(/\.md$/, '').toLowerCase(), grupo: grupo.titulo, titulo, md });
  }
  return (cache = guias);
}

/**
 * La pestaña «Flujos» con la forma de una pestaña del manual: un `<h2>` por grupo y un `<h3 id=<id>>`
 * por guía (su `#` baja a `###`, que es lo que pinta el índice «En esta pestaña»).
 */
export function pestanaDeFlujos(guias: Guia[]): PestanaManual | null {
  if (guias.length === 0) return null;
  let idActual = '';
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, { tokens, depth }: Tokens.Heading) {
        // El título de la guía (su único encabezado) lleva el id ESTABLE del archivo, no el del texto:
        // renombrar una guía no rompe los enlaces que ya apuntan a ella.
        return `<h${depth} id="${idActual}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  // Índice arriba (en el celular no se ve la columna «En esta pestaña»): una línea por grupo con sus guías.
  const enlace = (x: Guia) => `<a href="?tab=${PESTANA_FLUJOS}#${x.id}">${x.titulo}</a>`;
  let html = GRUPOS
    .map((g) => ({ g, delGrupo: guias.filter((x) => x.grupo === g.titulo) }))
    .filter(({ delGrupo }) => delGrupo.length > 0)
    .map(({ g, delGrupo }) => `<p><strong>${g.titulo}:</strong> ${delGrupo.map(enlace).join(' · ')}</p>`)
    .join('\n') + '\n';
  for (const g of GRUPOS) {
    const delGrupo = guias.filter((x) => x.grupo === g.titulo);
    if (delGrupo.length === 0) continue;
    html += `<h2 id="flujos-${g.letra.toLowerCase()}">${g.titulo}</h2>\n`;
    for (const guia of delGrupo) {
      idActual = guia.id;
      html += md.parse(guia.md.replace(/^#\s+/m, '### ')) as string;
    }
  }
  return {
    id: PESTANA_FLUJOS,
    titulo: 'Flujos',
    html,
    secciones: guias.map((g) => ({ id: g.id, titulo: g.titulo })),
  };
}
