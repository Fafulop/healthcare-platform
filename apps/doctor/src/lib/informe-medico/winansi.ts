/**
 * ¿Puede este texto imprimirse en el formato?
 *
 * Los PDFs oficiales usan fuentes estándar con codificación **WinAnsi (CP1252)**.
 * `pdf-lib` no falla al hacer `setText()`: falla al hacer `save()`, con
 * `WinAnsi cannot encode "β" (0x03b2)` — y ahí ya truena la generación ENTERA
 * del informe, no un campo.
 *
 * Medido el 2026-08-08 contra el AXA oficial:
 *   `Neumonía de Muñoz`  OK      (los acentos y la ñ SÍ son WinAnsi)
 *   `dolor — intenso`    OK
 *   `dijo “me duele”`    OK
 *   `HCG-β elevada`      TRUENA
 *   `≥ 3 días`           TRUENA
 *   `mejoría → alta`     TRUENA
 *   `T ≈ 38°`            TRUENA  (por `≈`; el `°` solo sí pasa)
 *
 * 🔴 **No se reescribe el texto del médico en silencio.** Cambiar `β` por "beta"
 * en un documento médico-legal firmado es peor que no imprimirlo: el campo se
 * OMITE y se REPORTA, para que la UI le diga al doctor exactamente qué carácter
 * quitar (01-FUENTES §4 — un hueco se ve, una alteración no).
 */

/** CP1252: los 27 caracteres del rango 0x80–0x9F que no son Latin-1. */
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function esImprimibleWinAnsi(cp: number): boolean {
  if (cp === 0x0a || cp === 0x0d || cp === 0x09) return true; // saltos y tab
  if (cp >= 0x20 && cp <= 0x7e) return true;                  // ASCII imprimible
  if (cp >= 0xa0 && cp <= 0xff) return true;                  // Latin-1 (á é í ó ú ñ ü ° …)
  return CP1252_EXTRA.has(cp);
}

/** Los caracteres del texto que el formato NO puede imprimir. Vacío = se puede. */
export function caracteresNoImprimibles(texto: string): string[] {
  const malos = new Set<string>();
  for (const ch of texto) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && !esImprimibleWinAnsi(cp)) malos.add(ch);
  }
  return [...malos];
}
