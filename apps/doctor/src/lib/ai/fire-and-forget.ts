/**
 * Dispara una escritura de telemetría sin bloquear la respuesta, y **sin poder
 * tumbarla**.
 *
 * El patrón que había en los tres loggers (`logTokenUsage`, `logToolErrors`,
 * `logToolCalls`) era:
 *
 *     prisma.loQueSea.create({ ... }).catch((err) => console.error(err));
 *
 * y tiene un agujero: **`.catch()` solo atrapa una promesa RECHAZADA, y para
 * eso la promesa tiene que existir.** Si `prisma.loQueSea` fuera `undefined`
 * —cliente de Prisma generado contra un schema viejo, que es justo lo que pasa
 * cuando un modelo NUEVO se despliega y el build reusa un `node_modules` en
 * caché— entonces `undefined.create` truena **SÍNCRONO**: no hay promesa, el
 * `.catch` nunca se engancha, y el throw sube por la pila hasta el try/catch de
 * la ruta, que responde **500**. O sea: una línea de telemetría pensada para ser
 * inofensiva se vuelve fatal, y no para un turno — para TODOS.
 *
 * Es el mismo molde del incidente que documenta el CLAUDE.md de la raíz (un
 * `$queryRaw` sobre una función que devuelve `void` tumbó la creación de citas):
 * compila, despliega verde, y revienta en runtime.
 *
 * `Promise.resolve().then(run)` convierte ese throw síncrono en un rechazo, que
 * es lo único que el `.catch` sí puede absorber. Con eso la promesa de
 * "fire-and-forget nunca afecta la respuesta" se vuelve cierta de verdad.
 *
 * Verificado en vivo 2026-07-31: el riesgo NO se materializó (el `postinstall:
 * prisma generate` de `packages/database` regeneró el cliente y `agent_tool_calls`
 * recibió su primera fila), pero solo se pudo comprobar mandándole un mensaje
 * real al agente — los evals llaman `runAgendaAgentTurn` directo y **no pasan por
 * la ruta**, así que ninguna suite habría cazado esto.
 */
export function fireAndForget(label: string, run: () => Promise<unknown>): void {
  Promise.resolve()
    .then(run)
    .catch((err) => {
      console.error(`[${label}] Failed:`, err);
    });
}
