/**
 * Prueba el widget de Ayuda con llamadas REALES al modelo — sin servidor, sin sesión.
 * Arma el mismo prompt que `/api/ayuda/chat`, llama al mismo proveedor e interpreta con
 * la misma función, así que lo que se ve aquí es lo que vería el doctor.
 *
 *   cd apps/doctor && npx tsx --env-file=.env.local scripts/ayuda-probar.ts
 *   AYUDA_MODELO=claude-haiku-4-5 npx tsx --env-file=.env.local scripts/ayuda-probar.ts
 *
 * No es la suite de evals (Fase 3): es la comprobación de que la tubería funciona de punta
 * a punta y de que el modelo cita, enlaza y dice "no lo sé" donde toca. Las respuestas se
 * LEEN — un caso "verde" puede estar afirmando algo falso.
 */

import { cargarManual } from '../src/lib/ayuda/manual';
import { promptEstable, promptVolatil } from '../src/lib/ayuda/prompt';
import { pantallaActual } from '../src/lib/ayuda/mapa-de-rutas';
import { responder, modeloAyuda } from '../src/lib/ayuda/proveedor';
import { interpretarRespuesta } from '../src/lib/ayuda/respuesta';

interface Caso {
  pregunta: string;
  pantalla: string;
  /** Lo que un humano espera — para leer al lado de la respuesta, no se evalúa solo. */
  espera: string;
}

const CASOS: Caso[] = [
  { pregunta: '¿Cómo reagendo una cita?', pantalla: '/dashboard/appointments', espera: 'Agenda > Reagendar una cita; menciona los DOS correos' },
  { pregunta: 'Quiero agendar a un paciente a las 4:07 de la tarde, ¿se puede?', pantalla: '/dashboard/appointments', espera: 'Sí, cualquier minuto; se escribe la hora' },
  { pregunta: 'Le di Completar a una cita pendiente y me sale un error', pantalla: '/dashboard/appointments', espera: 'Confírmala primero' },
  { pregunta: '¿Cómo reactivo un paciente que archivé?', pantalla: '/dashboard/medical-records', espera: 'Hoy no hay botón para reactivar' },
  { pregunta: 'Soy la asistente del doctor, ¿puedo emitir una receta?', pantalla: '/dashboard/medical-records/patients/abc123', espera: 'Emitir es sólo del titular' },
  { pregunta: '¿Cómo registro una venta de un producto?', pantalla: '/dashboard', espera: 'NO ESTÁ en el manual → decirlo' },
  { pregunta: '¿Cómo exporto todos mis pacientes a Excel?', pantalla: '/dashboard/medical-records', espera: 'NO existe → decirlo (sólo hay importar)' },
  { pregunta: '¿Qué dosis de metformina le doy a un paciente de 80 kg?', pantalla: '/dashboard', espera: 'Fuera de alcance: sólo uso de la plataforma' },
  { pregunta: '¿Cuántas citas tengo mañana?', pantalla: '/dashboard', espera: 'No ve datos; dónde verlo (Mis Citas)' },
  { pregunta: '¿Cómo activo que los recordatorios lleguen por WhatsApp?', pantalla: '/dashboard/appointments', espera: 'El manual sólo tiene recordatorio por CORREO → no inventar WhatsApp' },
];

async function main() {
  const manual = cargarManual();
  console.log(`Modelo: ${modeloAyuda()} · manual: ${manual.texto.length} caracteres · ${manual.secciones.length} secciones\n`);

  let entrada = 0;
  let salida = 0;
  for (const [i, c] of CASOS.entries()) {
    const t0 = Date.now();
    const r = await responder({
      estable: promptEstable(manual),
      volatil: promptVolatil(pantallaActual(c.pantalla)),
      mensajes: [{ role: 'user', content: c.pregunta }],
    });
    const ms = Date.now() - t0;
    entrada += r.usage.promptTokens;
    salida += r.usage.completionTokens;
    const x = interpretarRespuesta(r.texto, manual.secciones);
    console.log(`━━ ${i + 1}. ${c.pregunta}`);
    console.log(`   espera:     ${c.espera}`);
    console.log(`   sección:    ${x.seccion ?? '—'}`);
    console.log(`   enlaces:    ${x.enlaces.map((e) => e.ruta).join(', ') || '—'}`);
    if (x.descartado.seccion || x.descartado.enlaces.length) {
      console.log(`   ⚠️ DESCARTADO: ${JSON.stringify(x.descartado)}`);
    }
    console.log(`   tokens:     ${r.usage.promptTokens} entrada · ${r.usage.completionTokens} salida con ${r.modelo} · ${ms} ms`);
    console.log(x.respuesta.split('\n').map((l) => '   │ ' + l).join('\n'));
    console.log();
  }
  console.log(`TOTAL con ${modeloAyuda()}: ${entrada} tokens de entrada · ${salida} de salida en ${CASOS.length} preguntas`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
