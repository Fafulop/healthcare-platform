/**
 * TIERS 04 §11.4 · §12.6 #6.3 — «Descargar mi información»: TODO lo que el
 * doctor capturó, en un zip que se abre sin nosotros. SIN los archivos adjuntos
 * (sólo su LISTADO): son lo que pesa, y siguen guardados con nosotros.
 *
 *   LEEME.txt                 qué trae y qué no
 *   pacientes.csv · consultas.csv · citas.csv · recetas.csv · adjuntos.csv
 *   expedientes/<paciente>.html   el expediente completo, uno por paciente
 *
 * Sirve a una cuenta CONGELADA (la ruta vive bajo /api/account/, que está en
 * `RUTAS_DE_CUENTA_CONGELADA`) y a cualquier dueño que quiera un respaldo.
 *
 * Lo que se lleva es el EXPEDIENTE, no la contabilidad: los CFDI NO van en el
 * zip. Traerlos obligaba a bajar de Facturama, uno por uno y sin tope, el XML
 * de cada factura que nadie había descargado antes — decenas de segundos
 * dentro de una sola petición, y si el proxy la cortaba se perdía el zip
 * COMPLETO. Siguen en Facturación, que es de donde siempre se han sacado.
 *
 * Todo aquí es de SÓLO LECTURA: una descarga no debe escribir en la cuenta.
 *
 * 🔴 Fechas: `@db.Date` (nacimiento, primera/última visita, seguimiento) y
 * `Booking.date`/`slot.date` (medianoche UTC) se leen en UTC; los timestamps,
 * en la hora de México. Un solo formateador para las dos = un día de error.
 */

import { prisma } from '@healthcare/database';

const ZONA = 'America/Mexico_City';

type Valor = string | number | boolean | Date | null | undefined | { toString(): string };

/** Un día de calendario (`@db.Date` / medianoche UTC): se lee en UTC. */
function dia(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '';
}

/** Un instante: se lee en la hora de México. */
function instante(d: Date | null | undefined): string {
  if (!d) return '';
  // sv-SE da «AAAA-MM-DD HH:MM», que Excel ordena y entiende.
  return d.toLocaleString('sv-SE', { timeZone: ZONA, hour12: false }).slice(0, 16);
}

function texto(v: Valor): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return instante(v);
  // Un checkbox de plantilla guarda un booleano: `true` no es español. Y así el
  // NO marcado sale '' y lo tira el filtro de renglones vacíos de `tabla()`,
  // igual que cualquier otro campo sin llenar.
  if (typeof v === 'boolean') return v ? 'Sí' : '';
  if (Array.isArray(v)) return v.map((x) => texto(x as Valor)).join(', ');
  if (typeof v === 'object' && v.constructor === Object) return JSON.stringify(v);
  return String(v);
}

/**
 * Los valores internos (en inglés o MAYÚSCULAS) en el español que el doctor ve en
 * la app. Sacados de los comentarios del schema y del enum BookingStatus; lo que
 * no esté aquí sale tal cual (mejor crudo que inventado).
 */
const EN_ESPANOL: Record<string, string> = {
  male: 'Masculino', female: 'Femenino', other: 'Otro',
  active: 'Activo', inactive: 'Inactivo', archived: 'Archivado',
  consultation: 'Consulta', 'follow-up': 'Seguimiento', emergency: 'Urgencia',
  telemedicine: 'Telemedicina', 'pre-cita': 'Pre-cita',
  draft: 'Borrador', completed: 'Completada', amended: 'Enmendada',
  issued: 'Emitida', cancelled: 'Cancelada', expired: 'Vencida',
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada',
  COMPLETED: 'Completada', NO_SHOW: 'No asistió',
  PRESENCIAL: 'Presencial', TELEMEDICINA: 'Telemedicina',
};
const es = (v: string | null | undefined) => (v ? EN_ESPANOL[v] ?? v : '');

/**
 * Los enums de `Task` ya están en español, pero en MAYÚSCULAS con guión bajo
 * (`EN_PROGRESO`). Se les baja el tono en vez de mapearlos uno por uno: la lista
 * de categorías no está cerrada en ningún lado, y traducir a mano lo que no se
 * conoce completo es inventar. Esto sólo cambia la FORMA, nunca el valor.
 */
const comoTitulo = (v: string | null | undefined): string => {
  if (!v) return '';
  const s = v.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ── CSV ──────────────────────────────────────────────────────────────────────
// BOM + CRLF: sin el BOM, Excel abre el UTF-8 como Latin-1 y rompe los acentos.
function csv(encabezados: string[], filas: Valor[][]): string {
  const celda = (v: Valor) => {
    // El LEEME dice «los .csv se abren con Excel», y Excel EJECUTA como fórmula
    // toda celda que empiece con = o @. Varias columnas las teclea un extraño en
    // el formulario público de reservas (nombre, correo, notas de una cita), así
    // que ahí se antepone un apóstrofo: Excel lo lee como «esto es texto».
    //
    // Sólo `=` y `@`, NO `+` ni `-`: el apóstrofo es invisible en Excel pero es
    // un carácter de verdad en Google Sheets, LibreOffice y cualquier lector de
    // CSV, y `+52 33 …` —un teléfono, no una fórmula— es muchísimo más común en
    // estos datos que un ataque. Se prefiere el dato limpio.
    let s = texto(v);
    if (/^[=@]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n';
}

// ── HTML ─────────────────────────────────────────────────────────────────────
// TODO lo que se escribe pasa por `esc`: son datos capturados por personas.
function esc(v: Valor): string {
  return texto(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Filas etiqueta/valor; las vacías no se pintan (una ficha llena de «—» no se lee). */
function tabla(pares: [string, Valor][]): string {
  const llenas = pares.filter(([, v]) => texto(v).trim() !== '');
  if (llenas.length === 0) return '';
  return (
    '<table>' +
    llenas.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    '</table>'
  );
}

const ESTILO = `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;color:#111;line-height:1.45}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
h3{font-size:15px;margin:18px 0 6px}.meta{color:#666;font-size:13px}
table{border-collapse:collapse;width:100%;margin:4px 0 10px;font-size:14px}
th,td{border:1px solid #e3e3e3;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f7f7f7;width:32%;font-weight:600}
.bloque{border:1px solid #e3e3e3;border-radius:6px;padding:10px 12px;margin:10px 0}
@media print{.bloque{break-inside:avoid}}`;

function nombreArchivo(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'sin-nombre'
  );
}

/** customData de una plantilla ⇒ pares con la ETIQUETA del campo, no su clave interna. */
function camposDePlantilla(customData: unknown, customFields: unknown): [string, Valor][] {
  if (!customData || typeof customData !== 'object') return [];
  const etiquetas = new Map<string, string>();
  if (Array.isArray(customFields)) {
    for (const f of customFields as { name?: string; label?: string; labelEs?: string }[]) {
      if (f?.name) etiquetas.set(f.name, f.labelEs || f.label || f.name);
    }
  }
  return Object.entries(customData as Record<string, unknown>).map(([k, v]) => [
    etiquetas.get(k) ?? k,
    v as Valor,
  ]);
}

/**
 * `MedicalReport.answers` NO guarda el valor suelto: guarda
 * `{ value, source, origin }` por campo (`informe-medico/types.ts`, réplica del
 * comentario del schema). Sin desenvolverlo, cada renglón del informe se
 * imprimía como el JSON completo contra su clave interna.
 *
 * `origin: 'empty'` es un blanco DECLARADO —hay dónde escribir y no hay qué—:
 * se omite, como cualquier otro campo vacío. Un formato de aseguradora trae
 * cientos.
 *
 * Se lee aquí a mano en vez de importar `leerAnswers`: vive en `apps/doctor` y
 * esto es `apps/api`. Si el conjunto de `origin` cambia, esta función sólo deja
 * de ocultar vacíos — no rompe.
 */
function respuestasDeInforme(answers: unknown): [string, Valor][] {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return [];
  const pares: [string, Valor][] = [];
  for (const [clave, bruto] of Object.entries(answers as Record<string, unknown>)) {
    // `campo:Código ICD` es un blanco crudo del PDF: la etiqueta es lo de después.
    const etiqueta = clave.startsWith(PREFIJO_CRUDO) ? clave.slice(PREFIJO_CRUDO.length) : clave;
    if (bruto && typeof bruto === 'object' && 'value' in bruto) {
      const v = bruto as { value?: unknown; origin?: unknown };
      if (v.origin === 'empty') continue;
      pares.push([etiqueta, v.value as Valor]);
    } else {
      // Forma inesperada: mejor crudo que perdido.
      pares.push([etiqueta, bruto as Valor]);
    }
  }
  return pares;
}

/** `informe-medico/types.ts`: prefijo de un blanco del PDF sin concepto canónico. */
const PREFIJO_CRUDO = 'campo:';

export interface Exportacion {
  /** ruta dentro del zip ⇒ contenido de texto (UTF-8). */
  archivos: Record<string, string>;
  /** Lo que NO se pudo incluir, con motivo — va también al LEEME. */
  faltantes: string[];
}

/**
 * Arma el contenido del zip de UN doctor. Sólo lee: ninguna rama escribe.
 *
 * `faltantes` es el canal para decir «esto NO pudo ir, y por qué»: se imprime
 * al final del LEEME. Hoy nada lo llena; existe para que un pedazo que falle
 * mañana se REPORTE en vez de salir como un hueco silencioso.
 */
export async function armarExportacion(doctorId: string): Promise<Exportacion> {
  const faltantes: string[] = [];

  const [doctor, pacientes, consultas, recetas, notas, historial, informes, adjuntos, citas, tareas] =
    await Promise.all([
      prisma.doctor.findUniqueOrThrow({
        where: { id: doctorId },
        // `doctorFullName` ya es el nombre COMPLETO con su «Dr./Dra.» (medido en
        // prod): pegarle `lastName` o un «Dr(a).» lo duplicaba.
        select: { slug: true, doctorFullName: true },
      }),
      prisma.patient.findMany({ where: { doctorId }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      prisma.clinicalEncounter.findMany({
        where: { doctorId },
        orderBy: { encounterDate: 'asc' },
        include: { template: { select: { name: true, customFields: true } } },
      }),
      prisma.prescription.findMany({
        where: { doctorId },
        orderBy: { prescriptionDate: 'asc' },
        include: {
          medications: { orderBy: { order: 'asc' } },
          imagingStudies: { orderBy: { order: 'asc' } },
          labStudies: { orderBy: { order: 'asc' } },
          // Una receta de PLANTILLA no tiene NI UN renglón de medicamento: sus
          // valores viven en `customData` (ver el route de recetas). Sin esto,
          // el doctor que usa plantillas se lleva un zip con la columna
          // «Medicamentos» vacía en todas sus recetas.
          template: { select: { name: true, customFields: true } },
        },
      }),
      prisma.patientNote.findMany({ where: { doctorId }, orderBy: { createdAt: 'asc' } }),
      prisma.patientMedicalHistory.findMany({ where: { doctorId }, orderBy: { changedAt: 'asc' } }),
      prisma.medicalReport.findMany({ where: { doctorId }, orderBy: { createdAt: 'asc' } }),
      prisma.patientMedia.findMany({ where: { doctorId }, orderBy: { captureDate: 'asc' } }),
      prisma.booking.findMany({
        where: { doctorId },
        include: { slot: { select: { date: true, startTime: true, endTime: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      // Los pendientes del doctor son suyos y los capturó él: van en el zip. No
      // hay nada que los haga caros ni nada de fuera que consultar.
      prisma.task.findMany({ where: { doctorId }, orderBy: { createdAt: 'asc' } }),
    ]);

  const nombreDe = new Map(pacientes.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));
  const paciente = (id: string | null | undefined) => (id ? nombreDe.get(id) ?? '' : '');
  const archivos: Record<string, string> = {};

  // ── CSV ────────────────────────────────────────────────────────────────────
  archivos['pacientes.csv'] = csv(
    ['Expediente', 'Nombre', 'Apellidos', 'Nacimiento', 'Sexo', 'Correo', 'Teléfono', 'Dirección', 'Ciudad',
      'Estado', 'CP', 'Contacto de emergencia', 'Tel. emergencia', 'Parentesco', 'Primera visita', 'Última visita',
      'Estatus', 'Etiquetas', 'Alergias', 'Padecimientos crónicos', 'Medicamentos actuales', 'Tipo de sangre',
      'Notas generales', 'Requiere factura', 'RFC', 'Razón social', 'Régimen fiscal', 'Uso CFDI', 'CP fiscal',
      'Aseguradora', 'Póliza', 'Alta'],
    pacientes.map((p) => [p.internalId, p.firstName, p.lastName, dia(p.dateOfBirth), es(p.sex), p.email, p.phone,
      p.address, p.city, p.state, p.postalCode, p.emergencyContactName, p.emergencyContactPhone,
      p.emergencyContactRelation, dia(p.firstVisitDate), dia(p.lastVisitDate), es(p.status), p.tags,
      p.currentAllergies, p.currentChronicConditions, p.currentMedications, p.bloodType, p.generalNotes,
      p.requiereFactura ? 'Sí' : 'No', p.rfc, p.razonSocial, p.regimenFiscal, p.usoCfdi, p.codigoPostalFiscal,
      p.polizaAseguradora, p.numeroPoliza, instante(p.createdAt)]),
  );

  archivos['consultas.csv'] = csv(
    ['Fecha', 'Paciente', 'Tipo', 'Motivo', 'Estatus', 'Plantilla', 'Lugar', 'Seguimiento'],
    consultas.map((c) => [instante(c.encounterDate), paciente(c.patientId), es(c.encounterType), c.chiefComplaint,
      es(c.status), c.template?.name, c.location, dia(c.followUpDate)]),
  );

  archivos['citas.csv'] = csv(
    ['Fecha', 'Inicio', 'Fin', 'Paciente', 'Correo', 'Teléfono', 'Servicio', 'Modalidad', 'Estatus', 'Precio',
      'Primera vez', 'Notas', 'Código', 'Creada'],
    citas.map((b) => [dia(b.date ?? b.slot?.date), b.startTime ?? b.slot?.startTime, b.endTime ?? b.slot?.endTime,
      b.patientName, b.patientEmail, b.patientPhone, b.serviceName, es(b.appointmentMode), es(b.status), b.finalPrice,
      b.isFirstTime ? 'Sí' : 'No', b.notes, b.confirmationCode, instante(b.createdAt)]),
  );

  archivos['recetas.csv'] = csv(
    ['Fecha', 'Paciente', 'Estatus', 'Diagnóstico', 'Medicamentos', 'Estudios de imagen', 'Estudios de laboratorio',
      'Plantilla', 'Campos de la plantilla'],
    recetas.map((r) => [instante(r.prescriptionDate), paciente(r.patientId), es(r.status), r.diagnosis,
      r.medications.map((m) => `${m.drugName} ${m.dosage} ${m.frequency}`.trim()).join(' | '),
      r.imagingStudies.map((s) => s.studyName).join(' | '),
      r.labStudies.map((s) => s.studyName).join(' | '),
      r.template?.name,
      camposDePlantilla(r.customData, r.template?.customFields)
        .filter(([, valor]) => texto(valor) !== '')
        .map(([etiqueta, valor]) => `${etiqueta}: ${texto(valor)}`)
        .join(' | ')]),
  );

  // `dueDate` es `@db.Date` (día de calendario) y `completedAt`/`createdAt` son
  // timestamps: cada uno con su formateador.
  archivos['tareas.csv'] = csv(
    ['Título', 'Descripción', 'Vence', 'Inicio', 'Fin', 'Prioridad', 'Estatus', 'Categoría',
      'Paciente', 'Completada', 'Creada'],
    tareas.map((t) => [t.title, t.description, dia(t.dueDate), t.startTime, t.endTime,
      comoTitulo(t.priority), comoTitulo(t.status), comoTitulo(t.category), paciente(t.patientId),
      instante(t.completedAt), instante(t.createdAt)]),
  );

  // Este CSV dice QUÉ ARCHIVOS TIENES GUARDADOS: si no están todos, afirma que
  // los que faltan no existen. `patientMedia` no es la lista completa — la foto
  // del paciente y su Constancia de Situación Fiscal son archivos subidos que
  // viven en columnas de `Patient`, y hay que nombrarlos aquí también.
  archivos['adjuntos.csv'] = csv(
    ['Paciente', 'Archivo', 'Fecha', 'Tipo', 'Tamaño (KB)', 'Categoría', 'Zona', 'Descripción'],
    [
      ...adjuntos.map((a) => [paciente(a.patientId), a.fileName, instante(a.captureDate), a.mediaType,
        a.fileSize != null ? Math.round(a.fileSize / 1024) : '', a.category, a.bodyArea, a.description] as Valor[]),
      ...pacientes.filter((p) => p.photoUrl).map((p) => [`${p.firstName} ${p.lastName}`.trim(),
        'Foto del paciente', '', '', '', 'Foto', '', ''] as Valor[]),
      ...pacientes.filter((p) => p.constanciaFiscalUrl).map((p) => [`${p.firstName} ${p.lastName}`.trim(),
        p.constanciaFiscalName || 'Constancia de Situación Fiscal', '', '', '', 'Constancia fiscal', '', ''] as Valor[]),
    ],
  );

  // ── Un HTML por paciente ───────────────────────────────────────────────────
  const porPaciente = <T extends { patientId: string }>(filas: T[]) => {
    const m = new Map<string, T[]>();
    // `push` sobre el arreglo que ya está, no una copia nueva por renglón: una
    // cuenta con miles de adjuntos en pocos pacientes lo volvía cuadrático.
    for (const f of filas) {
      const suyas = m.get(f.patientId);
      if (suyas) suyas.push(f);
      else m.set(f.patientId, [f]);
    }
    return m;
  };
  const consultasDe = porPaciente(consultas);
  const recetasDe = porPaciente(recetas);
  const notasDe = porPaciente(notas);
  const historialDe = porPaciente(historial);
  const informesDe = porPaciente(informes);
  const adjuntosDe = porPaciente(adjuntos);
  const usados = new Set<string>();

  for (const p of pacientes) {
    const partes: string[] = [];
    partes.push(`<h1>${esc(`${p.firstName} ${p.lastName}`)}</h1>`);
    partes.push(`<p class="meta">Expediente ${esc(p.internalId)} · ${esc(doctor.doctorFullName)} · exportado ${esc(instante(new Date()))}</p>`);

    partes.push('<h2>Datos del paciente</h2>');
    partes.push(tabla([
      ['Nacimiento', dia(p.dateOfBirth)], ['Sexo', es(p.sex)], ['Tipo de sangre', p.bloodType], ['Correo', p.email],
      ['Teléfono', p.phone], ['Dirección', [p.address, p.city, p.state, p.postalCode].filter(Boolean).join(', ')],
      ['Contacto de emergencia', [p.emergencyContactName, p.emergencyContactRelation, p.emergencyContactPhone].filter(Boolean).join(' · ')],
      ['Alergias', p.currentAllergies], ['Padecimientos crónicos', p.currentChronicConditions],
      ['Medicamentos actuales', p.currentMedications], ['Notas generales', p.generalNotes],
      ['Primera visita', dia(p.firstVisitDate)], ['Última visita', dia(p.lastVisitDate)], ['Estatus', es(p.status)],
      ['Etiquetas', p.tags], ['Aseguradora', p.polizaAseguradora], ['Póliza', p.numeroPoliza],
      ['RFC', p.rfc], ['Razón social', p.razonSocial], ['Régimen fiscal', p.regimenFiscal],
    ]));

    const susNotas = notasDe.get(p.id) ?? [];
    if (susNotas.length) {
      partes.push('<h2>Notas</h2>');
      for (const n of susNotas) {
        partes.push(`<div class="bloque"><p class="meta">${esc(instante(n.createdAt))}</p>${esc(n.content).replace(/\n/g, '<br>')}</div>`);
      }
    }

    const susConsultas = consultasDe.get(p.id) ?? [];
    if (susConsultas.length) {
      partes.push('<h2>Consultas</h2>');
      for (const c of susConsultas) {
        partes.push('<div class="bloque">');
        partes.push(`<h3>${esc(instante(c.encounterDate))} — ${esc(c.chiefComplaint)}</h3>`);
        partes.push(tabla([
          ['Tipo', es(c.encounterType)], ['Estatus', es(c.status)], ['Plantilla', c.template?.name], ['Lugar', c.location],
          ['Notas clínicas', c.clinicalNotes], ['Subjetivo', c.subjective], ['Objetivo', c.objective],
          ['Análisis', c.assessment], ['Plan', c.plan],
          ['Presión arterial', c.vitalsBloodPressure], ['Frecuencia cardiaca', c.vitalsHeartRate],
          ['Temperatura', c.vitalsTemperature], ['Peso', c.vitalsWeight], ['Talla', c.vitalsHeight],
          ['Saturación O₂', c.vitalsOxygenSat], ['Otros signos', c.vitalsOther],
          ...camposDePlantilla(c.customData, c.template?.customFields),
          ['Seguimiento', dia(c.followUpDate)], ['Notas de seguimiento', c.followUpNotes],
          ['Enmienda', c.amendedAt ? `${instante(c.amendedAt)} — ${texto(c.amendmentReason)}` : ''],
        ]));
        partes.push('</div>');
      }
    }

    const susRecetas = recetasDe.get(p.id) ?? [];
    if (susRecetas.length) {
      partes.push('<h2>Recetas</h2>');
      for (const r of susRecetas) {
        partes.push('<div class="bloque">');
        partes.push(`<h3>${esc(instante(r.prescriptionDate))} — ${esc(es(r.status))}</h3>`);
        partes.push(tabla([['Diagnóstico', r.diagnosis], ['Notas', r.clinicalNotes], ['Cédula', r.doctorLicense],
          ['Plantilla', r.template?.name],
          ...camposDePlantilla(r.customData, r.template?.customFields),
          ['Cancelada', r.cancelledAt ? `${instante(r.cancelledAt)} — ${texto(r.cancellationReason)}` : '']]));
        for (const m of r.medications) {
          partes.push(tabla([['Medicamento', m.drugName], ['Presentación', m.presentation], ['Dosis', m.dosage],
            ['Frecuencia', m.frequency], ['Duración', m.duration], ['Cantidad', m.quantity],
            ['Indicaciones', m.instructions], ['Advertencias', m.warnings]]));
        }
        for (const s of r.imagingStudies) {
          partes.push(tabla([['Estudio de imagen', s.studyName], ['Región', s.region], ['Indicación', s.indication],
            ['Urgencia', s.urgency], ['Notas', s.notes]]));
        }
        for (const s of r.labStudies) {
          partes.push(tabla([['Estudio de laboratorio', s.studyName], ['Indicación', s.indication],
            ['Urgencia', s.urgency], ['Ayuno', s.fasting], ['Notas', s.notes]]));
        }
        partes.push('</div>');
      }
    }

    const susInformes = informesDe.get(p.id) ?? [];
    if (susInformes.length) {
      partes.push('<h2>Informes médicos</h2>');
      for (const i of susInformes) {
        partes.push(`<div class="bloque"><h3>${esc(i.formId)} — ${esc(instante(i.issuedAt ?? i.createdAt))} (${esc(es(i.status))})</h3>${tabla(respuestasDeInforme(i.answers))}</div>`);
      }
    }

    const susAdjuntos = adjuntosDe.get(p.id) ?? [];
    // Mismos dos archivos que en adjuntos.csv: la foto y la constancia fiscal
    // viven en columnas de `Patient`, no en `patientMedia`. Si la lista los
    // calla, dice que no existen.
    const otrosArchivos: [string, string][] = [
      ...(p.photoUrl ? ([['Foto del paciente', 'Foto']] as [string, string][]) : []),
      ...(p.constanciaFiscalUrl
        ? ([[p.constanciaFiscalName || 'Constancia de Situación Fiscal', 'Constancia fiscal']] as [string, string][])
        : []),
    ];
    if (susAdjuntos.length || otrosArchivos.length) {
      partes.push('<h2>Archivos adjuntos</h2>');
      partes.push('<p class="meta">Sólo la lista: los archivos siguen guardados en tu cuenta.</p>');
      partes.push(
        '<table><tr><th>Archivo</th><th>Fecha</th><th>Tipo</th><th>Descripción</th></tr>' +
          susAdjuntos.map((a) => `<tr><td>${esc(a.fileName)}</td><td>${esc(instante(a.captureDate))}</td><td>${esc(a.mediaType)}</td><td>${esc(a.description)}</td></tr>`).join('') +
          otrosArchivos.map(([nombre, tipo]) => `<tr><td>${esc(nombre)}</td><td></td><td>${esc(tipo)}</td><td></td></tr>`).join('') +
          '</table>',
      );
    }

    const suHistorial = historialDe.get(p.id) ?? [];
    if (suHistorial.length) {
      partes.push('<h2>Historial de cambios</h2>');
      partes.push(
        '<table><tr><th>Fecha</th><th>Campo</th><th>Antes</th><th>Después</th><th>Motivo</th></tr>' +
          suHistorial.map((h) => `<tr><td>${esc(instante(h.changedAt))}</td><td>${esc(h.fieldName)}</td><td>${esc(h.oldValue)}</td><td>${esc(h.newValue)}</td><td>${esc(h.changeReason)}</td></tr>`).join('') +
          '</table>',
      );
    }

    // Dos pacientes con el mismo nombre no pueden pisarse: el expediente desempata.
    let base = nombreArchivo(`${p.lastName} ${p.firstName} ${p.internalId}`);
    while (usados.has(base)) base += '-2';
    usados.add(base);
    archivos[`expedientes/${base}.html`] =
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(`${p.firstName} ${p.lastName}`)}</title><style>${ESTILO}</style></head><body>${partes.join('\n')}</body></html>`;
  }

  archivos['LEEME.txt'] = [
    `Tu información en TuSalud — ${doctor.doctorFullName} (${doctor.slug})`,
    `Exportada el ${instante(new Date())} (hora del centro de México).`,
    '',
    'Qué trae:',
    `- pacientes.csv: ${pacientes.length} pacientes con todos sus datos.`,
    `- consultas.csv: ${consultas.length} consultas.  citas.csv: ${citas.length} citas.  recetas.csv: ${recetas.length} recetas.`,
    `- tareas.csv: ${tareas.length} pendientes y recordatorios tuyos.`,
    `- adjuntos.csv: la LISTA de ${adjuntos.length + pacientes.filter((p) => p.photoUrl).length + pacientes.filter((p) => p.constanciaFiscalUrl).length} archivos adjuntos (nombre, fecha, paciente).`,
    `- expedientes/: un archivo por paciente con su expediente completo. Ábrelo con cualquier navegador; para guardarlo en PDF, imprímelo y elige «Guardar como PDF».`,
    '',
    'Qué NO trae: los archivos adjuntos en sí (fotos, PDFs, estudios). Siguen guardados en tu cuenta.',
    'Tampoco trae tus facturas (CFDI): el XML de cada una se descarga desde Facturación, en la app.',
    'Los .csv se abren con Excel.',
    ...(faltantes.length ? ['', 'No se pudo incluir:', ...faltantes.map((f) => `- ${f}`)] : []),
    '',
  ].join('\r\n');

  return { archivos, faltantes };
}
