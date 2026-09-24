/**
 * Prueba el widget de Ayuda con llamadas REALES al modelo — sin servidor, sin sesión.
 * Arma el mismo prompt que `/api/ayuda/chat`, llama al mismo proveedor e interpreta con
 * la misma función, así que lo que se ve aquí es lo que vería el doctor.
 *
 *   cd apps/doctor && npx tsx --env-file=.env.local scripts/ayuda-probar.ts
 *   … scripts/ayuda-probar.ts --veces=2              (dos corridas: una sola no distingue ruido)
 *   … scripts/ayuda-probar.ts --veces=2 --relleno=33000
 *
 * `--relleno=<tokens>` rodea el manual con ~N tokens de docs reales del repo que NO hablan de
 * cómo se usa la app (mitad antes, mitad después), para medir si el modelo sigue encontrando y
 * citando cuando el manual crezca. Las secciones citables siguen siendo SÓLO las del manual: citar
 * el relleno cuenta como error. El relleno es de otro tema, así que es una prueba de LONGITUD y
 * de POSICIÓN, no de secciones vecinas que compitan — ésa sólo se puede hacer cuando existan.
 *
 * La columna «cita» sí se evalúa sola (contra `citas`); lo demás se LEE — un caso con cita
 * correcta puede estar afirmando algo falso.
 */

import fs from 'fs';
import path from 'path';
import { cargarManual, type Manual } from '../src/lib/ayuda/manual';
import { promptEstable, promptVolatil } from '../src/lib/ayuda/prompt';
import { pantallaActual } from '../src/lib/ayuda/mapa-de-rutas';
import { responder, modeloAyuda } from '../src/lib/ayuda/proveedor';
import { interpretarRespuesta } from '../src/lib/ayuda/respuesta';

interface Caso {
  pregunta: string;
  pantalla: string;
  /** Lo que un humano espera — para leer al lado de la respuesta, no se evalúa solo. */
  espera: string;
  /** Secciones aceptables. `null` en la lista = también vale no citar (preguntas fuera del manual). */
  citas: (string | null)[];
}

const CASOS: Caso[] = [
  { pregunta: '¿Cómo reagendo una cita?', pantalla: '/dashboard/appointments', espera: 'Agenda > Reagendar una cita; menciona los DOS correos', citas: ['Agenda > Reagendar una cita'] },
  { pregunta: 'Quiero agendar a un paciente a las 4:07 de la tarde, ¿se puede?', pantalla: '/dashboard/appointments', espera: 'Sí, cualquier minuto; se escribe la hora', citas: ['Agenda > Agendar una cita'] },
  { pregunta: 'Le di Completar a una cita pendiente y me sale un error', pantalla: '/dashboard/appointments', espera: 'Confírmala primero', citas: ['Agenda > Citas que piden tus pacientes'] },
  { pregunta: '¿Cómo reactivo un paciente que archivé?', pantalla: '/dashboard/medical-records', espera: 'Hoy no hay botón para reactivar', citas: ['Expediente > Archivar un paciente'] },
  { pregunta: 'Soy la asistente del doctor, ¿puedo emitir una receta?', pantalla: '/dashboard/medical-records/patients/abc123', espera: 'Emitir es sólo del titular', citas: ['Expediente > Recetas'] },
  { pregunta: '¿Cómo registro una venta de un producto?', pantalla: '/dashboard', espera: 'NO ESTÁ en el manual → decirlo', citas: [null] },
  { pregunta: '¿Cómo exporto todos mis pacientes a Excel?', pantalla: '/dashboard/medical-records', espera: 'NO existe → decirlo (sólo hay importar)', citas: [null, 'Expediente > Importar pacientes', 'Expediente > Línea de tiempo'] },
  { pregunta: '¿Qué dosis de metformina le doy a un paciente de 80 kg?', pantalla: '/dashboard', espera: 'Fuera de alcance: sólo uso de la plataforma', citas: [null] },
  { pregunta: '¿Cuántas citas tengo mañana?', pantalla: '/dashboard', espera: 'No ve datos; dónde verlo (Mis Citas)', citas: [null, 'Agenda > La tabla de citas', 'Agenda > Qué hay en la pantalla'] },
  { pregunta: '¿Cómo activo que los recordatorios lleguen por WhatsApp?', pantalla: '/dashboard/appointments', espera: 'El manual sólo tiene recordatorio por CORREO → no inventar WhatsApp', citas: ['Agenda > Recordatorios'] },

  // Respuestas «NO se puede» que SÍ salen del manual — el patrón donde gpt-4o-mini dejaba la
  // sección vacía (2026-09-22). Ninguna es el ejemplo del prompt, para no medir si copia.
  { pregunta: '¿Puedo editar una receta que ya emití?', pantalla: '/dashboard/medical-records/patients/abc123', espera: 'No: emitida ya no se edita (cancelar y hacer otra)', citas: ['Expediente > Recetas'] },
  { pregunta: 'Eliminé una cita por error, ¿cómo la recupero?', pantalla: '/dashboard/appointments', espera: 'No se puede deshacer', citas: ['Agenda > Cancelar, No asistió y Eliminar'] },
  { pregunta: '¿Tengo que crear rangos para poder agendar a un paciente?', pantalla: '/dashboard/appointments', espera: 'No: los rangos son para lo que piden los pacientes', citas: ['Agenda > Rangos de disponibilidad'] },
  { pregunta: 'Ya marqué un informe de AXA como emitido y tiene un error, ¿lo puedo corregir?', pantalla: '/dashboard/medical-records/patients/abc123', espera: 'No se edita: «Generar un informe nuevo»', citas: ['Expediente > Informe para aseguradora'] },
  { pregunta: 'En la vista Mes, ¿puedo dar clic en un día para agendar ahí?', pantalla: '/dashboard/appointments', espera: 'No: en Mes el clic lleva al día; agendar con clic es en Día/Semana', citas: ['Agenda > Agendar desde el calendario'] },
  { pregunta: 'Cuando marco No asistió, ¿le llega un aviso al paciente?', pantalla: '/dashboard/appointments', espera: 'No, sin avisar', citas: ['Agenda > Cancelar, No asistió y Eliminar'] },
  { pregunta: 'Si mando la confirmación por WhatsApp, ¿la plataforma registra que ya la mandé?', pantalla: '/dashboard/appointments', espera: 'No se entera', citas: ['Agenda > Confirmar la cita con el paciente'] },
  { pregunta: 'Cancelé una cita sin querer, ¿la puedo regresar a Agendada?', pantalla: '/dashboard/appointments', espera: 'No: Cancelada es final; agendar otra', citas: ['Agenda > Los estados de una cita', 'Agenda > Cancelar, No asistió y Eliminar', 'Agenda > Qué puedes hacer con cada cita'] },
];

/** Docs del repo que no describen el uso de la app — relleno para la prueba de longitud. */
const RELLENO_FUENTES = [
  'docs/DESDE JUNIO/NEW NAME',
  'docs/DESDE JUNIO/IMAGE MIGRATION',
  'docs/DESDE JUNIO/POSSIBLE FUTURE TOOLS',
  'docs/DESDE JUNIO/NEW STYLE/01-TECNICA-velvet-y-reveals.md',
];
/** Aproximación sólo para dimensionar; el número real sale del `usage` que regresa el modelo. */
const CARACTERES_POR_TOKEN = 4;

function arg(nombre: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1];
}

function textoDeRelleno(tokens: number): string {
  const raiz = path.resolve(__dirname, '../../..');
  const archivos = RELLENO_FUENTES.flatMap((f) => {
    const p = path.join(raiz, f);
    return fs.statSync(p).isDirectory()
      ? fs.readdirSync(p).filter((n) => n.endsWith('.md')).sort().map((n) => path.join(p, n))
      : [p];
  });
  const pool = archivos.map((f) => fs.readFileSync(f, 'utf-8').trim()).join('\n\n---\n\n');
  const meta = tokens * CARACTERES_POR_TOKEN;
  // Si el pool no alcanza se repite: prueba longitud, no variedad.
  let texto = '';
  while (texto.length < meta) texto += (texto ? '\n\n---\n\n' : '') + pool;
  return texto.slice(0, meta);
}

function conRelleno(manual: Manual, tokens: number): Manual {
  if (tokens <= 0) return manual;
  const r = textoDeRelleno(tokens);
  const mitad = Math.floor(r.length / 2);
  return {
    texto: `${r.slice(0, mitad)}\n\n---\n\n${manual.texto}\n\n---\n\n${r.slice(mitad)}`,
    // Sólo las secciones del manual son citables: citar el relleno es un error.
    secciones: manual.secciones,
    bloques: manual.bloques,
  };
}

/**
 * El tope de OpenAI es por ORGANIZACIÓN (gpt-4o-mini: 200k tokens/min, compartido con prod): con
 * `--relleno` cada pregunta pesa ~40k y a la quinta seguida llega un 429. Aquí se espera y se
 * reintenta; en el endpoint NO, a propósito — allá el 429 es una señal, no ruido de la prueba.
 */
async function conReintento<T>(f: () => Promise<T>): Promise<T> {
  for (let intento = 1; ; intento++) {
    try {
      return await f();
    } catch (e) {
      const limite = (e as { code?: string }).code === 'rate_limit_exceeded';
      if (!limite || intento >= 5) throw e;
      console.log(`   (429 por tokens/minuto — espero 20 s, intento ${intento})`);
      await new Promise((r) => setTimeout(r, 20_000));
    }
  }
}

function citaOk(c: Caso, seccion: string | null): boolean {
  return c.citas.includes(seccion);
}

async function corrida(manual: Manual, n: number) {
  let entrada = 0;
  let salida = 0;
  const fallos: string[] = [];
  for (const [i, c] of CASOS.entries()) {
    const t0 = Date.now();
    const r = await conReintento(() =>
      responder({
        estable: promptEstable(manual),
        volatil: promptVolatil(pantallaActual(c.pantalla)),
        mensajes: [{ role: 'user', content: c.pregunta }],
      })
    );
    const ms = Date.now() - t0;
    entrada += r.usage.promptTokens;
    salida += r.usage.completionTokens;
    const x = interpretarRespuesta(r.texto, manual);
    const ok = citaOk(c, x.seccion);
    if (!ok) fallos.push(`${i + 1}`);
    console.log(`━━ [corrida ${n}] ${i + 1}. ${c.pregunta}`);
    console.log(`   espera:     ${c.espera}`);
    console.log(`   cita:       ${ok ? '✅' : '❌'} ${x.seccion ?? '—'}${ok ? '' : `   (válidas: ${c.citas.map((s) => s ?? 'ninguna').join(' | ')})`}`);
    console.log(`   enlaces:    ${x.enlaces.map((e) => e.ruta).join(', ') || '—'}`);
    if (x.descartado.seccion || x.descartado.enlaces.length || x.descartado.cita) {
      console.log(`   ⚠️ DESCARTADO: ${JSON.stringify(x.descartado)}`);
    }
    console.log(`   tokens:     ${r.usage.promptTokens} entrada · ${r.usage.completionTokens} salida con ${r.modelo} · ${ms} ms`);
    console.log(x.respuesta.split('\n').map((l) => '   │ ' + l).join('\n'));
    console.log();
  }
  return { entrada, salida, fallos };
}

async function main() {
  const veces = Math.max(1, Number(arg('veces') ?? 1) || 1);
  const relleno = Math.max(0, Number(arg('relleno') ?? 0) || 0);
  const manual = conRelleno(cargarManual(), relleno);
  console.log(
    `Modelo: ${modeloAyuda()} · manual${relleno ? ` + ~${relleno} tokens de relleno` : ''}: ` +
      `${manual.texto.length} caracteres · ${manual.secciones.length} secciones citables · ${CASOS.length} casos × ${veces}\n`
  );

  const resumen: string[] = [];
  for (let n = 1; n <= veces; n++) {
    const { entrada, salida, fallos } = await corrida(manual, n);
    resumen.push(
      `corrida ${n}: citas ${CASOS.length - fallos.length}/${CASOS.length}` +
        `${fallos.length ? ` (fallan: ${fallos.join(', ')})` : ''} · ` +
        `${entrada} tokens de entrada (${Math.round(entrada / CASOS.length)}/pregunta) · ${salida} de salida con ${modeloAyuda()}`
    );
  }
  console.log('══ RESUMEN');
  for (const l of resumen) console.log('   ' + l);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
