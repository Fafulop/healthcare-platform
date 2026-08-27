/**
 * USD -> texto, para las dos pantallas que muestran costo de IA (`/llm-usage` y
 * `/feature-usage`). Vive aquí y no copiado en cada página porque el caso interesante
 * es el `null`, y dos copias de esa regla se separan en silencio.
 *
 * 🔴 **`null` NO es `$0.00`.** `null` = hubo un modelo que no sabemos cobrar, así que
 * no sabemos cuánto costó; `0` = de verdad no gastó nada. Pintar el primero como el
 * segundo sería afirmar un hecho falso sobre el gasto, que es justo lo que estas
 * pantallas vienen a contestar.
 */
export function formatUsd(v: number | null): string {
  if (v === null) return 'n/d';
  if (v > 0 && v < 0.01) return '<$0.01';
  return `$${v.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
