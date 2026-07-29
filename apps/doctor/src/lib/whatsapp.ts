/**
 * Normaliza un teléfono para un enlace wa.me.
 *
 * wa.me exige el número INTERNACIONAL completo (sin +). Medido en prod sobre las citas
 * CONFIRMED con número: 46 guardan 10 dígitos SIN lada de país y 35 ya traen el 52. Un
 * `replace(/\D/g,'')` a secas —lo que hacía el botón de WhatsApp del formulario fiscal—
 * genera un enlace muerto para la mitad de los casos.
 *
 * Plataforma MX: 10 dígitos ⇒ se antepone 52. Devuelve "" cuando el número no puede
 * funcionar (menos de 10 dígitos: hay registros de 5 a 8 dígitos), para que la UI muestre
 * "Necesita WhatsApp" en vez de un enlace que no va a abrir nada.
 */
export function waNumber(raw?: string | null): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  if (digits.length === 10) return `52${digits}`;
  return digits;
}
