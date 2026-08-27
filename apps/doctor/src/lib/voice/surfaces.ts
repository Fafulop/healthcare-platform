/**
 * De qué PANTALLA salió una transcripción de voz.
 *
 * `/api/voice/transcribe` lo llaman once lugares distintos y todos escribían el mismo
 * `endpoint` en `llm_token_usage`, así que "¿usa la voz en notas o en plantillas?" no se
 * podía contestar. El valor viaja en el FormData como `surface`.
 *
 * ⚠️ Estas llaves las LEE `apps/api/src/lib/llm-features.ts` (`VOICE_SURFACES`) para
 * ponerles etiqueta en el admin. Son dos apps distintas sin paquete compartido: si
 * agregas una llave aquí, agrégala allá en el MISMO commit o saldrá con su nombre crudo.
 */
import type { VoiceSessionType } from '@/types/voice-assistant';

/**
 * `useVoiceSession` (modal de grabación) y `useChatSession` (barra lateral de voz) se
 * montan CADA UNO en 7 pantallas. Etiquetarlos con una constante por hook —"voz-modal",
 * "voz-chat"— habría vuelto a meter en un solo cajón justo lo que esta feature separa.
 * Los dos ya reciben `sessionType`, que ES la pantalla: se deriva de ahí.
 *
 * Se pierde a propósito la distinción modal-vs-barra: la pregunta del admin es en qué
 * PANTALLA se usa la voz, no con cuál de los dos widgets.
 */
const POR_TIPO_DE_SESION: Record<VoiceSessionType, string> = {
  NEW_PATIENT: 'paciente',
  NEW_ENCOUNTER: 'consulta',
  NEW_PRESCRIPTION: 'receta',
  CREATE_APPOINTMENT_SLOTS: 'agenda',
  CREATE_LEDGER_ENTRY: 'flujo',
  CREATE_SALE: 'ventas',
  CREATE_PURCHASE: 'compras',
  NEW_TASK: 'pendientes',
};

export function surfaceDeSesion(tipo: VoiceSessionType): string {
  return POR_TIPO_DE_SESION[tipo] ?? 'desconocido';
}
