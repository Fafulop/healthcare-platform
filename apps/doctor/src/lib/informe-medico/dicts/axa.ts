/**
 * Diccionario del formato **AXA — GMM Informe Médico** (el OFICIAL, 277 campos).
 *
 * `campoCanónico -> nombre del campo AcroForm`. Tonto a propósito: aquí no hay
 * lógica, sólo la tabla (04-MAPEO §1). A futuro esto vive en
 * `insurance_forms.field_dict` y se da de alta por admin; mientras no exista esa
 * pantalla, el diccionario del formato con el que arranca v1 vive en el repo.
 *
 * 🔎 Los nombres NO se copiaron de los docs: se leyeron del PDF oficial
 * (`axa-oficial-vacio.pdf`) con pdf-lib. Varios se ven raros —
 * `Nombre y presentación del medicamento Ej Paracetamol 100 mg1`— porque el
 * campo se llama literalmente así: el generador tomó el texto de la etiqueta.
 *
 * ⚠️ Lo que este diccionario NO mapea, y por qué (04-MAPEO §3):
 *   - `Código ICD` y `Estadificación TNM` → el expediente no tiene CIE-10 ni
 *     estadificación. Se quedan vacíos y los teclea el médico. **No se le pide
 *     al LLM que los deduzca.**
 *   - `En caso de haber seleccionado Hospital indique el nombre del hospital` →
 *     no hay camino desde el informe a un hospital, y hospital ≠ consultorio.
 *   - Las 45 casillas → el renderer sólo escribe campos de texto; el marcado de
 *     casillas es trabajo aparte y va después (04-MAPEO §4d).
 *   - `Día`, `Día_2`… → cajas de fecha sin semántica en su nombre; hay que
 *     resolver a qué pregunta pertenece cada una antes de mapearlas.
 */
import { claveMedicamento, MAX_MEDICAMENTOS, type CampoMedicamento } from '../canonical';
import type { FieldDict } from '../types';

/** Los campos escalares. Las listas se agregan abajo. */
const ESCALARES: FieldDict = {
  // Identidad
  'paciente.apellidoPaterno': 'Apellido paterno',
  'paciente.apellidoMaterno': 'Apellido materno',
  'paciente.nombres': 'Nombres',
  'paciente.edad': 'Edad',

  // Vitales
  'vitales.talla': 'Talla',
  'vitales.peso': 'Peso',
  'vitales.tensionArterial': 'Tensión arterial',

  // Clínico. `Padecimiento actual…` y `Señale los datos relevantes…` son los
  // dos campos grandes del formato y empatan con `subjective` y `objective`.
  'clinico.padecimientoActual': 'Padecimiento actual principales signos síntomas y detalles de evolución',
  'clinico.exploracionFisica': 'Señale los datos relevantes de exploración física',
  // El primer renglón de la tabla de diagnósticos. Los renglones 2..10 los llena
  // el médico: el expediente tiene UN `assessment` de texto libre, no una lista.
  'clinico.diagnostico': 'DiagnósticoRow1',
  // 🔴 `plan` es el tratamiento PROPUESTO, no el `Tratamiento recibidoRow1` de la
  // tabla de diagnósticos (ése es pasado). Mapearlo ahí diría algo falso.
  'clinico.tratamiento': 'Tratamiento propuesto quirúrgico no quirúrgico',

  // El médico. AXA repite el bloque dos veces (`_2` es el segundo médico), así
  // que sólo se llena el primero.
  'medico.nombre': 'Nombre',
  'medico.especialidad': 'Especialidad',
  'medico.cedulaProfesional': 'Cédula profesional',
  'medico.cedulaEspecialidad': 'Cédula de especialidad',
  'medico.telefono': 'Teléfono',
  'medico.domicilio': 'Domicilio',

  // El informe
  'informe.lugar': 'Lugar',
  'informe.lugarYFecha': 'Lugar y fechaRow1',
};

/**
 * La tabla de 10 medicamentos. El índice va PEGADO al nombre del campo
 * (`…Ej Paracetamol 100 mg1`), sin separador.
 */
const CAMPO_PDF_MEDICAMENTO: Record<CampoMedicamento, string> = {
  nombre: 'Nombre y presentación del medicamento Ej Paracetamol 100 mg',
  cantidad: 'Cantidad Ej 1 tableta',
  frecuencia: 'Cada cuánto Ej Cada 24 hrs',
  duracion: 'Durante cuánto tiempo Ej Por un mes',
};

function conMedicamentos(base: FieldDict): FieldDict {
  const dict: FieldDict = { ...base };
  for (let n = 1; n <= MAX_MEDICAMENTOS; n++) {
    for (const campo of Object.keys(CAMPO_PDF_MEDICAMENTO) as CampoMedicamento[]) {
      dict[claveMedicamento(n, campo)] = `${CAMPO_PDF_MEDICAMENTO[campo]}${n}`;
    }
  }
  return dict;
}

export const DICT_AXA: FieldDict = conMedicamentos(ESCALARES);
