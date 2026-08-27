/**
 * Traduce el `endpoint` técnico de `llm_token_usage` al nombre de la FUNCIÓN que el
 * doctor cree estar usando ("Notas por voz", "Constructor de plantillas"), para que
 * el admin pueda leer QUÉ usa cada doctor sin conocer el ruteo del app.
 *
 * Vive en `apps/api` y las etiquetas viajan EN LA RESPUESTA: `apps/admin` es otro Next
 * app que habla con este por HTTP, así que si duplicáramos el mapa allá tendríamos dos
 * verdades que se separan en silencio. El admin sólo pinta lo que le llega.
 *
 * ⚠️ Un endpoint que no esté aquí NO se descarta: se devuelve con su nombre crudo y
 * `known: false`. Desaparecer una función nueva de la tabla sería peor que enseñarla fea.
 */

export interface FeatureMeta {
  /** Etiqueta para un humano. */
  label: string;
  /** Agrupador de columnas en el admin. */
  category: 'Expediente' | 'Agenda' | 'Administración' | 'Plantillas' | 'Voz' | 'Asistentes';
}

const FEATURES: Record<string, FeatureMeta> = {
  // Asistentes conversacionales
  'agenda-agent': { label: 'Asistente 🟢', category: 'Asistentes' },
  'llm-assistant': { label: 'Ayuda (widget)', category: 'Asistentes' },
  'appointments-chat': { label: 'Chat agenda v1', category: 'Agenda' },

  // Expediente
  'encounter-chat': { label: 'Consulta', category: 'Expediente' },
  'prescription-chat': { label: 'Receta', category: 'Expediente' },
  'patient-chat': { label: 'Alta de paciente', category: 'Expediente' },
  'informe-chat': { label: 'Informe aseguradora', category: 'Expediente' },
  'informe-dictado': { label: 'Informe (dictado)', category: 'Expediente' },

  // Plantillas
  'form-builder-chat': { label: 'Constructor de plantillas', category: 'Plantillas' },

  // Administración
  'task-chat': { label: 'Pendientes', category: 'Administración' },
  'ledger-chat': { label: 'Flujo de dinero', category: 'Administración' },
  'sale-chat': { label: 'Ventas', category: 'Administración' },
  'purchase-chat': { label: 'Compras', category: 'Administración' },
  'quotation-chat': { label: 'Cotizaciones', category: 'Administración' },
  'bank-statement-parse': { label: 'Estado de cuenta (PDF)', category: 'Administración' },

  // Voz
  'voice-transcribe': { label: 'Transcripción de voz', category: 'Voz' },
  'voice-structure': { label: 'Voz → campos', category: 'Voz' },
  'voice-chat': { label: 'Conversación por voz', category: 'Voz' },
};

/**
 * De dónde salió una transcripción de voz. `voice-transcribe` lo llaman ONCE pantallas
 * distintas y todas escribían el MISMO `endpoint`, así que "¿usó voz en notas o en
 * plantillas?" era imposible de contestar. Estas llaves las manda el cliente y se
 * guardan en `llm_token_usage.surface`.
 *
 * ⚠️ Sólo aplica hacia ADELANTE: las filas anteriores al 2026-08-27 tienen `surface`
 * NULL y son irrecuperables — no se puede deducir la pantalla desde la fila.
 */
export const VOICE_SURFACES: Record<string, string> = {
  'notas': 'Notas',
  'notas-paciente': 'Notas del paciente',
  'plantillas': 'Constructor de plantillas',
  'consulta': 'Consulta',
  'receta': 'Receta',
  'paciente': 'Alta de paciente',
  'pendientes': 'Pendientes',
  'ventas': 'Ventas',
  'compras': 'Compras',
  'cotizaciones': 'Cotizaciones',
  'flujo': 'Flujo de dinero',
  'agenda': 'Agenda (horarios)',
  'agenda-v1': 'Chat agenda v1',
};

/** Etiqueta de un endpoint. Nunca lanza: lo desconocido regresa con su nombre crudo. */
export function featureOf(endpoint: string): FeatureMeta & { key: string; known: boolean } {
  const meta = FEATURES[endpoint];
  return meta
    ? { key: endpoint, ...meta, known: true }
    : { key: endpoint, label: endpoint, category: 'Asistentes', known: false };
}

/**
 * Etiqueta de una fila de voz, con su pantalla cuando se sabe.
 * `surface` NULL ⇒ "origen desconocido", explícito: no se colapsa con las que sí se saben.
 */
export function voiceLabel(endpoint: string, surface: string | null): string {
  const base = featureOf(endpoint).label;
  if (endpoint !== 'voice-transcribe') return base;
  if (!surface) return `${base} (origen desconocido)`;
  return `${base} — ${VOICE_SURFACES[surface] ?? surface}`;
}

/** Catálogo completo, para que el admin arme sus columnas sin adivinar. */
export function allFeatures(): Array<FeatureMeta & { key: string }> {
  return Object.entries(FEATURES).map(([key, meta]) => ({ key, ...meta }));
}
