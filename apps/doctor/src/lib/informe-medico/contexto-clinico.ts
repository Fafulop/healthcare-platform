/**
 * Una consulta del expediente, en TEXTO, para dársela a un modelo.
 *
 * Compartido por el DICTADO y el CHAT: los dos le pasan consultas al LLM y los
 * dos tienen que armarlas igual. Estaba en línea dentro de `dictar/route.ts`.
 *
 * 🔴 La regla de alcance (06-AGENTE §7): esto se llama **sólo** con consultas
 * del MISMO paciente y del MISMO doctor — el `where` lo comprueba, no se confía
 * en los ids que mande el cliente.
 */
import { prisma } from '@healthcare/database';

export interface ConsultaParaModelo {
  titulo: string;
  contenido: string;
}

/** Tope duro de consultas por llamada: el prompt no crece sin límite. */
export const MAX_CONSULTAS = 5;

/** La zona del negocio. El servidor corre en UTC; "hoy" nunca es UTC aquí. */
const MX_TZ = 'America/Mexico_City';

export async function consultasParaModelo(
  encounterIds: string[],
  patientId: string,
  doctorId: string
): Promise<ConsultaParaModelo[]> {
  const ids = [...new Set(encounterIds)].slice(0, MAX_CONSULTAS);
  if (ids.length === 0) return [];

  const encs = await prisma.clinicalEncounter.findMany({
    where: { id: { in: ids }, patientId, doctorId },
    include: { template: { select: { name: true, customFields: true } } },
    orderBy: { encounterDate: 'desc' },
  });

  const salida: ConsultaParaModelo[] = [];
  for (const e of encs) {
    const partes: string[] = [];
    if (e.chiefComplaint) partes.push(`Motivo de consulta: ${e.chiefComplaint}`);
    for (const [k, v] of [
      ['Padecimiento actual', e.subjective], ['Exploración física', e.objective],
      ['Diagnóstico', e.assessment], ['Tratamiento', e.plan], ['Notas', e.clinicalNotes],
    ] as Array<[string, string | null]>) if (v) partes.push(`${k}: ${v}`);

    // `customData` con las ETIQUETAS de su plantilla, no con las claves crudas:
    // se le entrega al modelo "Tipo de Lesión: nevo displásico", no
    // "tipoLesion: nevo". `EncounterTemplate.customFields` guarda esas etiquetas.
    const campos = Array.isArray(e.template?.customFields) ? e.template.customFields : [];
    const etiquetaDe = new Map<string, string>();
    for (const f of campos as Array<{ name?: string; label?: string; labelEs?: string }>) {
      if (f?.name) etiquetaDe.set(f.name, f.labelEs || f.label || f.name);
    }
    const custom = (e.customData ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(custom)) {
      if (v === null || v === undefined || v === '') continue;
      partes.push(`${etiquetaDe.get(k) ?? k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    }

    if (partes.length > 0) {
      salida.push({
        // 🔴 La zona va EXPLÍCITA, que es la convención del repo
        // (`agenda-agent/dates.ts`, facturas, fiscal). `encounterDate` es un
        // timestamp con hora —no `@db.Date`— y el servidor corre en UTC: con
        // `toISOString()` (lo que hacía `dictar`) una consulta de las 6 de la
        // tarde en CDMX se le presenta al modelo fechada al DÍA SIGUIENTE, que
        // es el campo que la aseguradora cruza contra la fecha del siniestro.
        titulo: `Consulta del ${e.encounterDate.toLocaleDateString('es-MX', { timeZone: MX_TZ })}${e.template?.name ? ` (${e.template.name})` : ''}`,
        contenido: partes.join('\n'),
      });
    }
  }
  return salida;
}
