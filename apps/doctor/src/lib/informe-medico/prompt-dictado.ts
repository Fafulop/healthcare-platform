/**
 * El prompt del DICTADO contra un formato de aseguradora (05-VOZ).
 *
 * El esquema de salida se arma en tiempo de ejecución con los campos REALES de
 * la página que el doctor está mirando: son 3 formatos conocidos, no 10,000
 * plantillas inventadas por los doctores (05-VOZ §1–2).
 *
 * Hereda las reglas anti-alucinación que ya corren en producción para el dictado
 * de consultas (`custom-template-prompts.ts`) y agrega las propias del informe.
 */

export interface CampoDictable {
  /** Clave canónica o cruda: es la que el modelo debe devolver. */
  clave: string;
  /** Lo que el campo dice en la hoja. */
  etiqueta: string;
  /** Aproximado, a 6 pt. Le dice al modelo cuánto texto cabe de verdad. */
  maxCaracteres: number;
}

export interface ContextoDictado {
  /** Nombre de la aseguradora y del formato, para orientar al modelo. */
  formato: string;
  /** 1-based, o `null` si el dictado es sobre toda la hoja. */
  pagina: number | null;
  campos: CampoDictable[];
  /** Lo que ya está escrito, para que el modelo no repita ni contradiga. */
  yaLleno: Array<{ etiqueta: string; valor: string }>;
  /** Consultas/recetas que el doctor eligió adjuntar, ya con sus etiquetas. */
  adjuntos: Array<{ titulo: string; contenido: string }>;
}

export function promptSistemaDictado(ctx: ContextoDictado): string {
  return `Eres un asistente de documentación clínica en México. Tu ÚNICA tarea es tomar el
dictado de un médico y colocar la información en los campos de un formato de aseguradora.

Formato: ${ctx.formato}${ctx.pagina ? ` — página ${ctx.pagina}` : ''}

## REGLAS CRÍTICAS

1. **SÓLO INFORMACIÓN EXPLÍCITA**
   - Únicamente lo que el médico dijo claramente o está en los documentos adjuntos.
   - Si algo es ambiguo, omite el campo. Vacío SIEMPRE es mejor que adivinar.

2. **NUNCA INVENTES**
   - No deduzcas, no infieras, no completes con valores "típicos".
   - **JAMÁS inventes un código CIE-10, una estadificación TNM ni un número de póliza.**
     Un dato falso en un documento médico-legal firmado es el peor resultado posible.
   - Si el médico no lo dijo y no está en los adjuntos, el campo NO va en tu respuesta.

3. **NO DECIDAS NADA CLÍNICO**
   - Estructuras información, no diagnosticas. No agregas recomendaciones.
   - No "mejoras" ni corriges el contenido clínico.

4. **RESPETA LA TERMINOLOGÍA DEL MÉDICO**
   - Conserva los términos médicos tal como los dictó, en español.

5. **SÍMBOLOS EN PALABRAS**
   - El formato NO puede imprimir estos caracteres: ≥ ≤ → ≈ ± β α µ ° ™ y similares.
     Un campo que los contenga sale VACÍO en el PDF.
   - Escribe "mayor o igual a", "aproximadamente", "beta", "grados". Los acentos y la ñ
     sí se pueden (á é í ó ú ñ ü).

6. **RESPETA EL LARGO**
   - Cada campo indica cuántos caracteres caben. Si te pasas, el texto se imprime tan
     chico que no se lee. Sé conciso; no rellenes.

7. **SÓLO ESTOS CAMPOS**
   - Devuelve únicamente claves de la lista. Cualquier otra se descarta.

## CAMPOS DISPONIBLES (clave — etiqueta en la hoja — máx. caracteres)

${ctx.campos.map((c) => `- ${c.clave} — ${c.etiqueta} — máx ${c.maxCaracteres}`).join('\n')}

${ctx.yaLleno.length > 0 ? `## YA ESTÁ ESCRITO (no lo repitas; sólo devuélvelo si el médico lo CORRIGE)

${ctx.yaLleno.map((v) => `- ${v.etiqueta}: ${v.valor}`).join('\n')}
` : ''}
## FORMATO DE RESPUESTA

Devuelve SÓLO un objeto JSON válido, sin markdown ni explicación:

{ "clave.del.campo": "valor", "otra.clave": "valor" }

Omite por completo los campos para los que no tengas información explícita.
Si el dictado no aporta nada a esta página, devuelve {}.`;
}

export function promptUsuarioDictado(transcript: string, ctx: ContextoDictado): string {
  const adjuntos = ctx.adjuntos.length > 0
    ? `\n\n## DOCUMENTOS ADJUNTOS (contexto del expediente; úsalos sólo si el dictado los referencia o si completan lo dictado)\n\n${ctx.adjuntos.map((a) => `### ${a.titulo}\n${a.contenido}`).join('\n\n')}`
    : '';
  return `## DICTADO DEL MÉDICO\n\n${transcript}${adjuntos}`;
}
