/**
 * Ayuda H3 — revisión de las guías de la pestaña «Flujos» (`src/lib/ayuda/guias/`). Correr antes de
 * publicar un cambio a una guía:
 *
 *   npx tsx --tsconfig tsconfig.json scripts/ayuda-guias-check.ts      (desde apps/doctor)
 *
 * Falla (exit 1) si:
 *  · la línea «QA (interno…)» o «Video: (pendiente)» llega al HTML de la página;
 *  · dos guías comparten id, o el ancla de una guía no está en el HTML;
 *  · una «etiqueta» citada en una guía no existe como texto en el código (apps/doctor, apps/public,
 *    apps/api, packages/database) y no está en PERMITIDAS. Es el método de deriva: así se habría
 *    cazado la guía de Citas que estuvo obsoleta desde abril.
 */
import fs from 'fs';
import path from 'path';
import { cargarGuias, pestanaDeFlujos } from '../src/lib/ayuda/guias';

/**
 * Etiquetas que NO están literales en el código y está bien: ejemplos con valores (horas, montos,
 * conteos), texto que se arma en tiempo de ejecución («Necesita {que}») y títulos de OTRAS guías.
 * Cada una se revisó a mano contra el código el 2026-10-05.
 */
const PERMITIDAS = new Set([
  // A1-A2 — ejemplos y título de otra guía
  '10:00 AM · Consultorio Satélite', 'Completar una cita', 'Consulta de Seguimiento · 30 min · $650',
  // A11/A12 — conteos armados en el código
  'Bloquear N día(s)', 'N día(s) bloqueado(s)', '1 rango de 5h (09:00 – 14:00)', 'Crear N Rangos',
  'Se crearon N rangos de disponibilidad',
  // A4/A14 — títulos de otras guías
  'Publicar tu horario', 'Crear tu propia plantilla',
  // A15 — folio y estado se arman en el PDF (`nota-venta-pdf.ts`: `Pago: ${…}`)
  'Nota de venta · ING-…', 'Pago: Pagada',
  // A17 — `Teléfono {required ? "*" : …}`
  'Teléfono *',
  // A5 — horas de ejemplo; `Necesita {que}`
  '10:30–11:15', 'Bloqueo: 10:30–11:00', 'Necesita correo', 'Necesita WhatsApp',
  // T1/T6 — conteos y montos de ejemplo
  'Crear y agendar N citas', 'Se le mandó al paciente UN correo con las N citas', 'Sesión 1 de 3 — … agendada',
  'Hecha · cobrado $800 (ING-…)', 'Sesión 1 de 3 — (tratamiento)',
]);

const RAIZ = path.resolve(__dirname, '../../..');
const FUENTES = ['apps/doctor/src', 'apps/public/src', 'apps/api/src', 'packages/database/src'].map((d) => path.join(RAIZ, d));

function leerFuentes(): string {
  const partes: string[] = [];
  const recorrer = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') recorrer(p); }
      else if (/\.(tsx?)$/.test(e.name)) partes.push(fs.readFileSync(p, 'utf-8'));
    }
  };
  FUENTES.filter((d) => fs.existsSync(d)).forEach(recorrer);
  return partes.join('\n');
}

const problemas: string[] = [];
const guias = cargarGuias();
const pestana = pestanaDeFlujos(guias);
if (!pestana || guias.length === 0) problemas.push('No hay guías: la pestaña «Flujos» no aparecería.');
const html = pestana?.html ?? '';

if (html.includes('QA (interno')) problemas.push('Una línea «QA (interno…)» llegó al HTML.');
if (/Video:<\/strong>\s*\(pendiente\)/.test(html)) problemas.push('«Video: (pendiente)» llegó al HTML.');

const ids = new Set<string>();
for (const g of guias) {
  if (ids.has(g.id)) problemas.push(`id repetido: ${g.id}`);
  ids.add(g.id);
  const veces = html.split(`id="${g.id}"`).length - 1;
  if (veces !== 1) problemas.push(`${g.id}: su ancla aparece ${veces} veces en el HTML (debe ser 1)`);
}

const fuentes = leerFuentes();
const fuentesPlanas = fuentes.replace(/\s+/g, ' ');
let etiquetas = 0;
for (const g of guias) {
  for (const [, e] of g.md.matchAll(/«([^»]{1,120})»/g)) {
    etiquetas++;
    const t = e.trim();
    const sinPuntos = t.replace(/[.…]+$/, '').trim();
    const esta = [t, sinPuntos].some((x) => x && (fuentes.includes(x) || fuentesPlanas.includes(x)));
    if (!esta && !PERMITIDAS.has(t)) problemas.push(`${g.id}: «${t}» no está en el código`);
  }
}

console.log(`Guías: ${guias.length} (${[...new Set(guias.map((g) => g.grupo))].join(' · ')}) · etiquetas revisadas: ${etiquetas}`);
if (problemas.length) {
  console.log(`\n❌ ${problemas.length} problema(s):`);
  for (const p of problemas) console.log('  - ' + p);
  process.exit(1);
}
console.log('✅ Sin QA ni «Video (pendiente)» en la página, anclas únicas y presentes, etiquetas en el código.');
