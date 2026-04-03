"use client";

import { type ReactNode } from "react";
import {
  Users,
  UserPlus,
  FolderOpen,
  FileText,
  Pill,
  Image,
  Clock,
  NotebookPen,
  ClipboardList,
  Sparkles,
  Mic,
  Download,
  Star,
  ArrowRight,
  Edit,
  Trash2,
  Plus,
  Settings,
  Stethoscope,
  Calendar,
  Type,
  AlignLeft,
  Hash,
  ChevronDown,
  Circle,
  CheckSquare,
  Upload,
  LayoutGrid,
  PanelRight,
  Save,
  Eye,
} from "lucide-react";
import { SectionAccordion } from "./SectionAccordion";
import { WorkflowStep } from "./WorkflowStep";
import { AppBadge } from "./AppBadge";

/* ─── small helpers ─── */

function Btn({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200 font-medium">
      {children}
    </span>
  );
}

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
      <Sparkles className="w-3 h-3" />
      Chat IA
    </span>
  );
}

function VoiceBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
      <Mic className="w-3 h-3" />
      Voz
    </span>
  );
}

export function ExpedientesGuide() {
  return (
    <div className="space-y-4">

      {/* ── Overview ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-teal-50 rounded-lg">
            <FolderOpen className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Expedientes Médicos</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona el historial completo de cada paciente: consultas, prescripciones, documentos, notas y línea de tiempo clínica.
            </p>
          </div>
        </div>

        {/* Top buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[
            {
              btn: <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nuevo Paciente</Btn>,
              desc: "Crea un expediente nuevo. El ID interno se genera automáticamente si lo dejas vacío.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><FileText className="w-3 h-3" />Plantillas</Btn>,
              desc: "Diseña formularios de consulta personalizados por especialidad. Configúralos antes de crear consultas.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><ClipboardList className="w-3 h-3" />Formularios</Btn>,
              desc: "Bandeja de formularios pre-cita recibidos de pacientes.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <div>{item.btn}</div>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Búsqueda y filtros
          </p>
          <ul className="space-y-1 text-xs text-gray-600">
            {[
              "Buscar por nombre o email (coincidencia parcial).",
              "Filtro de estado: Activos (predeterminado) o Archivados.",
              "Los pacientes archivados no se eliminan — siguen accesibles con el filtro 'Archivados'.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Plantillas de Consulta ── PRIORITIZED FIRST ── */}
      <SectionAccordion
        title="Plantillas de consulta — Form Builder"
        subtitle="Crea primero tus plantillas antes de registrar consultas"
        icon={Settings}
        accentColor="indigo"
        defaultOpen
      >
        {/* Why first callout */}
        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 text-xs text-indigo-800 mb-4">
          <strong>¿Por qué configurar plantillas primero?</strong> Las plantillas definen los campos que aparecerán en cada consulta. Si tienes una plantilla marcada como predeterminada, se aplica automáticamente al abrir "Nueva Consulta". Sin plantillas, el formulario solo muestra los campos SOAP estándar.
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Create Template</Btn>
          <AppBadge variant="doctor" />
          <AIBadge />
        </div>

        {/* 3-panel layout explanation */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Interfaz del Form Builder — 3 paneles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: <LayoutGrid className="w-4 h-4 text-blue-600" />,
                label: "Panel izquierdo — Paleta",
                desc: "9 tipos de campo disponibles. Arrastra al lienzo (desktop) o haz clic para agregar (móvil).",
                note: "Solo visible en desktop (≥ md).",
              },
              {
                icon: <FileText className="w-4 h-4 text-gray-600" />,
                label: "Centro — Lienzo",
                desc: "Aquí se construye el formulario. Arrastra campos para reordenar. Los campos se agrupan por sección.",
                note: "Sección por defecto: 'General'.",
              },
              {
                icon: <PanelRight className="w-4 h-4 text-purple-600" />,
                label: "Panel derecho — Propiedades",
                desc: "Clic en cualquier campo del lienzo para editar sus propiedades: nombre, etiqueta, tipo, sección, ancho, etc.",
                note: "Solo visible en desktop (≥ lg).",
              },
            ].map((p) => (
              <div key={p.label} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                <div className="flex items-center gap-2">
                  {p.icon}
                  <p className="text-xs font-semibold text-gray-800">{p.label}</p>
                </div>
                <p className="text-xs text-gray-500">{p.desc}</p>
                <p className="text-xs text-gray-400 italic">{p.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Barra superior (Toolbar)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { btn: <span className="text-xs font-semibold text-gray-700 border-b border-gray-300 px-1">Nombre de la plantilla</span>, desc: "Campo inline — escribe directamente. Obligatorio para guardar." },
              { btn: <span className="text-xs text-gray-500 border-b border-gray-300 px-1">Descripción (opcional)</span>, desc: "Texto corto que aparece debajo del nombre en la lista de plantillas." },
              { btn: <div className="flex items-center gap-1"><Btn color="bg-gray-100 text-gray-700"><Eye className="w-3 h-3" />Vista previa</Btn></div>, desc: "Alterna entre modo edición y vista previa del formulario tal como lo verá el doctor al crear la consulta." },
              { btn: <AIBadge />, desc: "Abre el panel de Chat IA que puede agregar, modificar y eliminar campos del formulario con instrucciones en lenguaje natural." },
              { btn: <Btn color="bg-blue-600 text-white"><Save className="w-3 h-3" />Guardar</Btn>, desc: "Guarda la plantilla. Se deshabilita si hay errores de validación (campos sin nombre o sin etiqueta)." },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                <div>{item.btn}</div>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Pre-appointment toggle */}
          <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-800">
            <strong>Checkbox "Usar como formulario pre-cita"</strong> — Está en la segunda fila de la toolbar. Al activarlo, esta plantilla aparecerá como opción al enviar un formulario pre-cita desde la página de Citas. Los formularios llenados por el paciente se reciben en <Tag>Formularios</Tag>.
          </div>
        </div>

        {/* 9 field types */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            9 tipos de campo disponibles
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { icon: <Type className="w-3.5 h-3.5 text-gray-500" />, label: "Texto", desc: "Una línea. Ej: nombre del medicamento, diagnóstico." },
              { icon: <AlignLeft className="w-3.5 h-3.5 text-gray-500" />, label: "Texto largo", desc: "Área multilinea. Ej: descripción de síntomas, observaciones." },
              { icon: <Hash className="w-3.5 h-3.5 text-gray-500" />, label: "Número", desc: "Valor numérico. Configura min, max y step." },
              { icon: <Calendar className="w-3.5 h-3.5 text-gray-500" />, label: "Fecha", desc: "Date picker. Ej: fecha de inicio de síntomas." },
              { icon: <Clock className="w-3.5 h-3.5 text-gray-500" />, label: "Hora", desc: "Time picker. Ej: hora del último episodio." },
              { icon: <ChevronDown className="w-3.5 h-3.5 text-gray-500" />, label: "Desplegable", desc: "Select con opciones. Define las opciones en el panel derecho." },
              { icon: <Circle className="w-3.5 h-3.5 text-gray-500" />, label: "Selección", desc: "Radio buttons. Una sola opción de la lista." },
              { icon: <CheckSquare className="w-3.5 h-3.5 text-gray-500" />, label: "Casilla", desc: "Checkbox único. Sí / No. Ej: ¿paciente en ayuno?." },
              { icon: <Upload className="w-3.5 h-3.5 text-gray-500" />, label: "Archivo", desc: "Subir un archivo adjunto al campo." },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                <div className="flex-shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <p className="font-semibold text-gray-800">{f.label}</p>
                  <p className="text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Field properties (Config Panel) */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Propiedades de cada campo (panel derecho)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { prop: "Nombre (camelCase)", desc: "Identificador interno del campo. Ej: tipoLesion. Lo usa el asistente de voz." },
              { prop: "Etiqueta", desc: "Texto visible en el formulario. Ej: 'Tipo de Lesión'." },
              { prop: "Etiqueta Español", desc: "Versión en español para el asistente de voz. Debe ser claro y descriptivo." },
              { prop: "Requerido", desc: "Si está activo, el campo es obligatorio al guardar la consulta." },
              { prop: "Sección", desc: "Agrupa campos bajo un encabezado. Escribe el nombre o elige uno existente del autocompletado." },
              { prop: "Ancho", desc: "Completo (100%), Mitad (50%), Tercio (33%). Controla el layout en pantallas medianas." },
              { prop: "Texto de ejemplo", desc: "Placeholder visible en campos de texto y texto largo." },
              { prop: "Texto de ayuda", desc: "Nota pequeña debajo del campo. Útil para instrucciones breves." },
              { prop: "Opciones", desc: "Solo para Desplegable y Selección — agrega, edita y elimina las opciones." },
              { prop: "Min / Max / Step", desc: "Solo para Número — limita el rango y define el incremento." },
            ].map((item) => (
              <div key={item.prop} className="p-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="font-semibold text-gray-800">{item.prop}</p>
                <p className="text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Template list actions */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Acciones en la lista de plantillas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>, desc: "Vuelve a abrir el Form Builder con la plantilla cargada." },
              { btn: <Btn color="bg-yellow-50 text-yellow-700"><Star className="w-3 h-3" />Predeterminada</Btn>, desc: "Se aplica automáticamente al abrir 'Nueva Consulta'. Solo puede haber una predeterminada." },
              { btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>, desc: "Requiere confirmación en dos pasos. No elimina consultas previas que usaron la plantilla." },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div>{item.btn}</div>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs mt-3">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-gray-600">Predeterminada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                <ClipboardList className="w-3 h-3" />Pre-cita
              </span>
              <span className="text-gray-600">Disponible como formulario pre-cita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">Active</span>
              <span className="text-gray-600">Plantilla activa y disponible en el selector de consultas</span>
            </div>
          </div>
        </div>
      </SectionAccordion>

      {/* ── Nueva Consulta ── */}
      <SectionAccordion
        title="Crear una consulta"
        subtitle="Selecciona tu plantilla primero — los campos SOAP son el fallback"
        icon={Stethoscope}
        accentColor="blue"
        defaultOpen
      >
        <div className="flex items-center gap-2 mb-4">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Consulta</Btn>
          <AppBadge variant="doctor" />
          <AIBadge />
          <VoiceBadge />
        </div>

        {/* Template priority callout */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-800 mb-4">
          <strong>Flujo recomendado:</strong> Selecciona tu plantilla personalizada al inicio. Los campos de la plantilla definen cómo documentas la consulta. Los campos SOAP estándar siguen disponibles pero la plantilla es el formulario principal.
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Seleccionar plantilla" icon={Settings}
            tip="Si marcaste una plantilla como predeterminada en Plantillas, se aplica automáticamente aquí — no necesitas seleccionarla manualmente.">
            El selector de <strong>Plantilla</strong> está en la parte superior del formulario, antes de todo lo demás. Elige la plantilla correcta según el tipo de consulta.
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800 mb-0.5">Con plantilla seleccionada</p>
                <p className="text-blue-700">Los campos personalizados de la plantilla aparecen en el formulario. Son el formulario principal de la consulta.</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-700 mb-0.5">Sin plantilla (SOAP estándar)</p>
                <p className="text-gray-500">Solo aparecen los campos SOAP (S/O/A/P), signos vitales y motivo de consulta.</p>
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep number={2} title="Llenar el formulario clínico" icon={FileText}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Campos de la plantilla</p>
                <p className="text-gray-500">Los campos que diseñaste en el Form Builder aparecen aquí, en el orden y secciones que definiste.</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Notas SOAP + Signos Vitales</p>
                <ul className="space-y-0.5 text-gray-500">
                  {["S — Subjetivo", "O — Objetivo", "A — Evaluación", "P — Plan", "Notas Clínicas", "Presión, FC, Temp, Peso/Talla, SpO₂"].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep number={3} title="Usar Chat IA o Voz" icon={Sparkles}
            tip="El Chat IA entiende los campos personalizados de tu plantilla por su nombre en español (labelEs). Mientras más descriptivo sea el nombre del campo, mejor respuesta dará la IA.">
            <div className="flex flex-wrap gap-2 mt-1">
              <AIBadge />
              <span className="text-xs text-gray-600">Botón <strong>Chat IA</strong> en la esquina superior derecha. Llena campos SOAP y campos de la plantilla al mismo tiempo.</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <VoiceBadge />
              <span className="text-xs text-gray-600">Modal de voz — graba y transcribe la consulta. También mapea a los campos de la plantilla.</span>
            </div>
          </WorkflowStep>

          <WorkflowStep number={4} title="Seguimiento (Follow-up, opcional)" icon={Calendar}>
            Registra fecha y notas de seguimiento. Aparecen en azul en la vista de la consulta.
          </WorkflowStep>

          <WorkflowStep number={5} title="Guardar">
            Clic en <strong>Crear Consulta</strong>. Los datos de la plantilla se guardan en <code className="text-xs bg-gray-100 px-1 rounded">customData</code> junto con los campos SOAP.
          </WorkflowStep>
        </div>

        {/* Encounter detail actions */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Acciones sobre una consulta guardada
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { btn: <Btn color="bg-gray-100 text-gray-700"><Download className="w-3 h-3" />PDF</Btn>, desc: "Exporta la consulta como PDF con todos sus datos, incluyendo los campos de la plantilla." },
              { btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>, desc: "Modifica cualquier campo. El Chat IA también está disponible al editar." },
              { btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>, desc: "Elimina permanentemente. Pide confirmación antes de proceder." },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div>{item.btn}</div>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Crear un Paciente ── */}
      <SectionAccordion
        title="Crear un paciente"
        subtitle="Registrar un nuevo expediente médico"
        icon={UserPlus}
        accentColor="green"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nuevo Paciente</Btn>
          <AppBadge variant="doctor" />
          <AIBadge />
          <VoiceBadge />
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Abrir el formulario">
            Clic en el botón azul <strong>Nuevo Paciente</strong> en la esquina superior derecha.
          </WorkflowStep>
          <WorkflowStep number={2} title="Llenar los datos del paciente" icon={UserPlus}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Identificación (obligatorio)</p>
                <ul className="space-y-0.5 text-gray-600">
                  {["Nombres *", "Apellidos *", "Fecha de Nacimiento *", "Sexo *", "ID Interno (auto)", "Tipo de Sangre"].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Contacto y antecedentes</p>
                <ul className="space-y-0.5 text-gray-600">
                  {["Teléfono, Email", "Dirección, Ciudad, Estado", "Contacto de Emergencia", "Alergias", "Condiciones Médicas", "Medicamentos actuales", "Notas Generales", "Etiquetas (tags)"].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </WorkflowStep>
          <WorkflowStep number={3} title="Chat IA o Voz (opcional)" icon={Sparkles}
            tip="El Chat IA puede llenar múltiples campos si le describes al paciente en lenguaje natural.">
            <div className="flex flex-wrap gap-2 mt-1">
              <AIBadge /><span className="text-xs text-gray-600">Describe al paciente y la IA llena los campos automáticamente.</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <VoiceBadge /><span className="text-xs text-gray-600">Dicta los datos en voz — el sistema transcribe y mapea los campos.</span>
            </div>
          </WorkflowStep>
          <WorkflowStep number={4} title="Guardar">
            Clic en <strong>Crear Paciente</strong>. El sistema redirige al perfil del paciente creado.
          </WorkflowStep>
        </div>
      </SectionAccordion>

      {/* ── Perfil del Paciente ── */}
      <SectionAccordion
        title="Perfil del paciente — navegación y acciones"
        subtitle="Qué muestra y qué permite cada botón en el perfil"
        icon={Users}
        accentColor="gray"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { btn: <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Consulta</Btn>, desc: "Crea una nueva consulta clínica para este paciente." },
            { btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>, desc: "Modifica los datos demográficos y de contacto del paciente." },
            { btn: <Btn color="bg-gray-100 text-gray-700"><Clock className="w-3 h-3" />Línea de Tiempo</Btn>, desc: "Vista cronológica de todas las consultas, prescripciones, documentos y notas." },
            { btn: <Btn color="bg-gray-100 text-gray-700"><Image className="w-3 h-3" />Docs y Galería</Btn>, desc: "Sube y visualiza imágenes, videos, audios y documentos clínicos." },
            { btn: <Btn color="bg-gray-100 text-gray-700"><Pill className="w-3 h-3" />Prescripciones</Btn>, desc: "Lista de prescripciones del paciente (borradores y emitidas)." },
            { btn: <Btn color="bg-gray-100 text-gray-700"><NotebookPen className="w-3 h-3" />Notas</Btn>, desc: "Notas clínicas libres, no estructuradas, asociadas al paciente." },
            { btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Archivar</Btn>, desc: "Mueve al paciente a Archivados. No elimina el expediente." },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <div>{item.btn}</div>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Secciones del perfil</p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            {[
              "Información Rápida (sidebar): edad, primera y última visita, estado.",
              "Información de Contacto: teléfono, email, dirección.",
              "Contacto de Emergencia (si fue registrado).",
              "Notas Generales: texto libre del perfil.",
              "Notas Recientes: últimas 3 notas con link directo.",
              "Historial de Consultas: todas las consultas en tarjetas expandibles.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionAccordion>

      {/* ── Prescripciones ── */}
      <SectionAccordion
        title="Prescripciones"
        subtitle="Crear recetas con medicamentos, estudios de imagen y laboratorio"
        icon={Pill}
        accentColor="green"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Prescripción</Btn>
          <AppBadge variant="doctor" />
          <AIBadge />
          <VoiceBadge />
        </div>
        <div className="space-y-0">
          <WorkflowStep number={1} title="Información General">
            Fecha (obligatoria), expiración (opcional), diagnóstico, notas clínicas y opcionalmente vincular a una consulta existente.
          </WorkflowStep>
          <WorkflowStep number={2} title="Información del Doctor">
            Nombre completo y cédula profesional — requeridos para emitir.
          </WorkflowStep>
          <WorkflowStep number={3} title="Agregar contenido" icon={Pill}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
              {[
                { label: "Medicamentos", desc: "Nombre, dosis, vía, frecuencia, duración, notas." },
                { label: "Estudios de Imagen", desc: "Tipo de estudio y región anatómica." },
                { label: "Estudios de Laboratorio", desc: "Nombre del estudio y notas." },
              ].map((s) => (
                <div key={s.label} className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <p className="font-semibold text-gray-800 mb-0.5">{s.label}</p>
                  <p className="text-gray-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </WorkflowStep>
          <WorkflowStep number={4} title="Guardar" icon={FileText}
            tip="Una prescripción emitida no puede editarse. Si necesitas corregirla, crea una nueva.">
            <div className="flex flex-wrap gap-2 mt-1">
              <Btn color="bg-gray-600 text-white">Guardar como Borrador</Btn>
              <span className="text-xs text-gray-500">Editable. Estado: <Tag>Borrador</Tag></span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Btn color="bg-blue-600 text-white">Guardar y Emitir</Btn>
              <span className="text-xs text-gray-500">Final. Estado: <Tag>Emitida</Tag></span>
            </div>
          </WorkflowStep>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Borrador", color: "bg-gray-100 text-gray-700 border-gray-200" },
              { label: "Emitida", color: "bg-green-100 text-green-700 border-green-200" },
              { label: "Cancelada", color: "bg-red-100 text-red-700 border-red-200" },
            ].map((s) => (
              <span key={s.label} className={`px-2 py-0.5 rounded-full border font-medium ${s.color}`}>{s.label}</span>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Notas del Paciente ── */}
      <SectionAccordion
        title="Notas del paciente"
        subtitle="Notas clínicas libres, formato de dos paneles"
        icon={NotebookPen}
        accentColor="amber"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Nota</Btn>
          <AppBadge variant="doctor" />
          <VoiceBadge />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <p className="font-medium text-gray-800 mb-1">Panel izquierdo — Lista</p>
            <p className="text-gray-500">Todas las notas del paciente ordenadas por fecha. Clic en una para abrirla.</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
            <p className="font-medium text-gray-800 mb-1">Panel derecho — Editor</p>
            <p className="text-gray-500">Editor de texto libre con botón de grabación por voz. El audio se transcribe e inserta en la nota.</p>
          </div>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
          <strong>Cambios sin guardar:</strong> Si cambias de nota con cambios pendientes, el sistema pregunta antes de descartar.
        </div>
      </SectionAccordion>

      {/* ── Docs y Galería ── */}
      <SectionAccordion
        title="Documentos y galería"
        subtitle="Subir y visualizar archivos clínicos del paciente"
        icon={Image}
        accentColor="purple"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Subir Archivo</Btn>
          <AppBadge variant="doctor" />
        </div>
        <div className="space-y-0">
          <WorkflowStep number={1} title="Abrir la galería">
            Desde el perfil del paciente, clic en <Btn color="bg-gray-100 text-gray-700"><Image className="w-3 h-3" />Docs y Galería</Btn>.
          </WorkflowStep>
          <WorkflowStep number={2} title="Subir un archivo">
            Tipos soportados: imagen, video, audio. Metadatos opcionales: categoría, área del cuerpo, fecha de captura, descripción, notas del doctor.
          </WorkflowStep>
          <WorkflowStep number={3} title="Visualizar archivos"
            tip="La galería tiene filtros por categoría y tipo para encontrar estudios rápidamente.">
            Clic en cualquier archivo para abrirlo en el visualizador. Desde ahí puedes editar los metadatos o eliminar el archivo.
          </WorkflowStep>
        </div>
      </SectionAccordion>

      {/* ── Línea de Tiempo ── */}
      <SectionAccordion
        title="Línea de tiempo clínica"
        subtitle="Vista cronológica completa del historial del paciente"
        icon={Clock}
        accentColor="blue"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-gray-100 text-gray-700"><Clock className="w-3 h-3" />Línea de Tiempo</Btn>
          <AppBadge variant="doctor" />
        </div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Consultas", color: "text-blue-600" },
            { label: "Prescripciones", color: "text-emerald-600" },
            { label: "Documentos", color: "text-purple-600" },
            { label: "Notas", color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className={`text-lg font-bold ${s.color}`}>#</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Todos los eventos ordenados por fecha. Cada evento es un card con acceso directo al detalle.
        </p>
        <div className="flex items-center gap-2">
          <Btn color="bg-gray-100 text-gray-700"><Download className="w-3 h-3" />Exportar PDF</Btn>
          <p className="text-xs text-gray-500">Historia clínica completa en PDF con todas las consultas.</p>
        </div>
      </SectionAccordion>

      {/* ── Formularios Pre-Cita ── */}
      <SectionAccordion
        title="Formularios pre-cita recibidos"
        subtitle="Bandeja de formularios enviados por pacientes antes de su cita"
        icon={ClipboardList}
        accentColor="purple"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-gray-100 text-gray-700"><ClipboardList className="w-3 h-3" />Formularios</Btn>
          <AppBadge variant="doctor" />
        </div>
        <div className="space-y-0">
          <WorkflowStep number={1} title="Cómo llegan los formularios">
            El flujo comienza en <strong>Citas</strong>: el botón <Btn color="bg-purple-100 text-purple-700">Formulario</Btn> en una cita agendada genera un link único. Cuando el paciente lo llena, aparece aquí.
          </WorkflowStep>
          <WorkflowStep number={2} title="Ver y adjuntar" icon={ClipboardList}>
            Clic en <Btn color="bg-purple-100 text-purple-700">Ver y adjuntar →</Btn> para ver las respuestas y adjuntarlas al expediente del paciente.
          </WorkflowStep>
        </div>
        <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-800">
          <strong>Requisito:</strong> Para que una plantilla aparezca como opción al enviar el formulario pre-cita, debe tener el flag <Tag>Pre-cita</Tag> activado en su configuración.
        </div>
      </SectionAccordion>

    </div>
  );
}
