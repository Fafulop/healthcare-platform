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
} from "lucide-react";
import { SectionAccordion } from "./SectionAccordion";
import { WorkflowStep } from "./WorkflowStep";
import { AppBadge } from "./AppBadge";

/* ─── small helpers ─── */

function Btn({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${color}`}
    >
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
              desc: "Administra tus plantillas de consulta personalizadas.",
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
            Búsqueda y filtros en la lista
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

      {/* ── Crear un Paciente ── */}
      <SectionAccordion
        title="Crear un paciente"
        subtitle="Registrar un nuevo expediente médico"
        icon={UserPlus}
        accentColor="blue"
        defaultOpen
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
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Contacto y antecedentes</p>
                <ul className="space-y-0.5 text-gray-600">
                  {["Teléfono, Email", "Dirección, Ciudad, Estado", "Contacto de Emergencia", "Alergias", "Condiciones Médicas", "Medicamentos actuales", "Notas Generales", "Etiquetas (tags)"].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </WorkflowStep>
          <WorkflowStep number={3} title="Usar Chat IA o Voz (opcional)" icon={Sparkles}
            tip="El Chat IA puede llenar múltiples campos a la vez si le describes al paciente en lenguaje natural.">
            <div className="flex flex-wrap gap-2 mt-1">
              <AIBadge />
              <span className="text-xs text-gray-600">Describe al paciente y la IA llena los campos automáticamente.</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <VoiceBadge />
              <span className="text-xs text-gray-600">Dicta los datos del paciente en voz y el sistema transcribe y mapea los campos.</span>
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
        defaultOpen
      >
        <p className="text-xs text-gray-500 mb-3">
          Al entrar a un paciente, el perfil muestra un resumen y da acceso a todas las secciones de su expediente desde la barra superior.
        </p>

        {/* Profile action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            {
              btn: <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Consulta</Btn>,
              desc: "Crea una nueva consulta clínica para este paciente.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>,
              desc: "Modifica los datos demográficos y de contacto del paciente.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><Clock className="w-3 h-3" />Línea de Tiempo</Btn>,
              desc: "Vista cronológica de todas las consultas, prescripciones, documentos y notas.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><Image className="w-3 h-3" />Docs y Galería</Btn>,
              desc: "Sube y visualiza imágenes, videos, audios y documentos clínicos.",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><Pill className="w-3 h-3" />Prescripciones</Btn>,
              desc: "Lista de prescripciones del paciente (borradores y emitidas).",
            },
            {
              btn: <Btn color="bg-gray-100 text-gray-700"><NotebookPen className="w-3 h-3" />Notas</Btn>,
              desc: "Notas clínicas libres, no estructuradas, asociadas al paciente.",
            },
            {
              btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Archivar</Btn>,
              desc: "Mueve al paciente a Archivados. No elimina el expediente — se puede recuperar con el filtro.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <div>{item.btn}</div>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Profile panel contents */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Secciones del perfil (panel principal)
          </p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            {[
              "Información Rápida (sidebar): edad, fecha de primera y última visita, estado activo/archivado.",
              "Información de Contacto: teléfono, email, dirección completa.",
              "Contacto de Emergencia: nombre, teléfono, relación (si fue registrado).",
              "Notas Generales: texto libre guardado en el perfil del paciente.",
              "Notas Recientes: las últimas 3 notas clínicas con link directo. 'Ver todas' lleva a la sección de Notas.",
              "Historial de Consultas: todas las consultas en tarjetas expandibles con acceso directo.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionAccordion>

      {/* ── Nueva Consulta ── */}
      <SectionAccordion
        title="Crear una consulta (encounter)"
        subtitle="Registrar la consulta clínica con SOAP, signos vitales y plantilla"
        icon={Stethoscope}
        accentColor="indigo"
        defaultOpen
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Nueva Consulta</Btn>
          <AppBadge variant="doctor" />
          <AIBadge />
          <VoiceBadge />
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Seleccionar plantilla (opcional)">
            En la parte superior aparece el selector de <strong>Plantilla</strong>. Si tienes una plantilla configurada como predeterminada, se aplica automáticamente. Puedes cambiarla o dejarla en blanco para usar el formulario SOAP estándar.
          </WorkflowStep>
          <WorkflowStep number={2} title="Llenar el formulario clínico" icon={FileText}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Notas SOAP</p>
                <ul className="space-y-0.5 text-gray-600">
                  {[
                    "S — Subjetivo (síntomas)",
                    "O — Objetivo (exploración física)",
                    "A — Evaluación / Diagnóstico",
                    "P — Plan de tratamiento",
                    "Notas Clínicas adicionales",
                  ].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Signos Vitales</p>
                <ul className="space-y-0.5 text-gray-600">
                  {[
                    "Presión Arterial",
                    "Frecuencia Cardíaca",
                    "Temperatura",
                    "Peso / Talla",
                    "Saturación O₂",
                    "Otros vitales",
                  ].map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800">
              Si seleccionaste una plantilla personalizada, aparecen sus campos debajo del SOAP estándar.
            </div>
          </WorkflowStep>
          <WorkflowStep number={3} title="Seguimiento (Follow-up, opcional)" icon={Calendar}>
            Registra una <strong>fecha de seguimiento</strong> y notas de seguimiento. Aparecen resaltados en azul en la vista de la consulta.
          </WorkflowStep>
          <WorkflowStep number={4} title="Usar Chat IA o Voz (opcional)" icon={Sparkles}
            tip="El Chat IA puede actualizar campos SOAP y campos personalizados de la plantilla al mismo tiempo.">
            <div className="flex flex-wrap gap-2 mt-1">
              <AIBadge />
              <span className="text-xs text-gray-600">Botón <strong>Chat IA</strong> en la esquina superior derecha — abre un panel lateral para dictar o escribir y la IA llena el formulario.</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <VoiceBadge />
              <span className="text-xs text-gray-600">Modal de voz para grabar y transcribir la consulta automáticamente.</span>
            </div>
          </WorkflowStep>
          <WorkflowStep number={5} title="Guardar">
            Clic en <strong>Crear Consulta</strong>. La consulta queda guardada y aparece en el historial del paciente.
          </WorkflowStep>
        </div>

        {/* Encounter detail actions */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Acciones sobre una consulta guardada
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                btn: <Btn color="bg-gray-100 text-gray-700"><Download className="w-3 h-3" />PDF</Btn>,
                desc: "Exporta la consulta como archivo PDF con todos sus datos.",
              },
              {
                btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>,
                desc: "Modifica cualquier campo de la consulta. El Chat IA también está disponible al editar.",
              },
              {
                btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>,
                desc: "Elimina la consulta permanentemente. Pide confirmación antes de proceder.",
              },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <div>{item.btn}</div>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
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
            Fecha de prescripción (obligatoria), fecha de expiración (opcional), diagnóstico, notas clínicas y opcionalmente vincular a una consulta existente.
          </WorkflowStep>
          <WorkflowStep number={2} title="Información del Doctor">
            Nombre completo y cédula profesional — requeridos para emitir la prescripción.
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
            tip="Una prescripción emitida no puede editarse — solo se puede eliminar. Si necesitas corregirla, crea una nueva.">
            <div className="flex flex-wrap gap-2 mt-1">
              <Btn color="bg-gray-600 text-white">Guardar como Borrador</Btn>
              <span className="text-xs text-gray-500">Guardable y editable. Estado: <Tag>Borrador</Tag></span>
            </div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <Btn color="bg-blue-600 text-white">Guardar y Emitir</Btn>
              <span className="text-xs text-gray-500">Finaliza y emite. Estado: <Tag>Emitida</Tag></span>
            </div>
          </WorkflowStep>
        </div>

        {/* Prescription status + filters */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Estados y filtros
          </p>
          <div className="flex flex-wrap gap-2 text-xs mb-2">
            {[
              { label: "Borrador", color: "bg-gray-100 text-gray-700 border-gray-200" },
              { label: "Emitida", color: "bg-green-100 text-green-700 border-green-200" },
              { label: "Cancelada", color: "bg-red-100 text-red-700 border-red-200" },
            ].map((s) => (
              <span key={s.label} className={`px-2 py-0.5 rounded-full border font-medium ${s.color}`}>
                {s.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">La lista de prescripciones tiene filtro por estado en la parte superior.</p>
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

        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Interfaz de dos paneles</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                <p className="font-medium text-gray-800 mb-1">Panel izquierdo — Lista</p>
                <p className="text-gray-500">Muestra todas las notas del paciente ordenadas por fecha. Clic en una nota para abrirla en el editor.</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                <p className="font-medium text-gray-800 mb-1">Panel derecho — Editor</p>
                <p className="text-gray-500">Editor de texto libre. Guarda automáticamente o con el botón <strong>Guardar</strong>. Incluye botón de grabación por voz.</p>
              </div>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Grabación por voz</p>
            <ul className="space-y-1">
              {[
                "Botón de micrófono en la barra del editor — inicia y detiene la grabación.",
                "El audio se transcribe automáticamente y se inserta en la nota.",
                "Mientras transcribe, el indicador muestra 'Transcribiendo...'.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
            <strong>Cambios sin guardar:</strong> Si cambias de nota o creas una nueva con cambios pendientes, el sistema pregunta si deseas descartar los cambios antes de continuar.
          </div>
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
            Clic en <strong>Subir Archivo</strong>. Tipos soportados: imagen, video, audio. En el formulario de subida puedes agregar:
            <ul className="mt-1.5 space-y-1">
              {[
                "Categoría del archivo (ej. radiografía, laboratorio)",
                "Área del cuerpo (bodyArea)",
                "Fecha de captura",
                "Descripción libre",
                "Notas del doctor",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-500">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </WorkflowStep>
          <WorkflowStep number={3} title="Visualizar archivos"
            tip="La galería tiene filtros por categoría y tipo de archivo para encontrar estudios rápidamente.">
            Clic en cualquier archivo de la galería para abrirlo en el <strong>visualizador</strong>. Desde el visualizador puedes editar los metadatos o eliminar el archivo.
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

        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Resumen estadístico</p>
            <p className="text-xs">Al entrar a la línea de tiempo, aparece un bloque de 4 contadores:</p>
            <div className="grid grid-cols-4 gap-2 mt-2">
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
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">Vista cronológica</p>
            <p className="text-xs text-gray-600">
              Todos los eventos del paciente (consultas, prescripciones, documentos subidos y notas) aparecen ordenados por fecha. Cada evento es un card con acceso directo al detalle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Btn color="bg-gray-100 text-gray-700"><Download className="w-3 h-3" />Exportar PDF</Btn>
            <p className="text-xs text-gray-500">Genera un PDF con todas las consultas del paciente en formato de historia clínica.</p>
          </div>
        </div>
      </SectionAccordion>

      {/* ── Plantillas de Consulta ── */}
      <SectionAccordion
        title="Plantillas de consulta"
        subtitle="Crear formularios de consulta personalizados por especialidad"
        icon={Settings}
        accentColor="gray"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-gray-100 text-gray-700"><FileText className="w-3 h-3" />Plantillas</Btn>
          <AppBadge variant="doctor" />
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Para qué sirven</p>
            <ul className="space-y-1">
              {[
                "Diseñar formularios con los campos exactos que tu especialidad requiere.",
                "Usar el asistente de voz o Chat IA con tus propios campos personalizados.",
                "Crear flujos distintos por tipo de consulta (primera vez, seguimiento, urgencia).",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Template actions */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Acciones sobre cada plantilla
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  btn: <Btn color="bg-gray-100 text-gray-700"><Edit className="w-3 h-3" />Editar</Btn>,
                  desc: "Modifica el nombre, descripción, campos y color de la plantilla.",
                },
                {
                  btn: <Btn color="bg-yellow-50 text-yellow-700"><Star className="w-3 h-3" />Predeterminada</Btn>,
                  desc: "Marca esta plantilla como la que se aplica automáticamente al crear una nueva consulta.",
                },
                {
                  btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>,
                  desc: "Elimina la plantilla. Solo pide confirmación en dos pasos.",
                },
              ].map((item, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                  <div>{item.btn}</div>
                  <p className="text-xs text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Flags */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Indicadores en la lista de plantillas
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-gray-600">Plantilla predeterminada</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                  <ClipboardList className="w-3 h-3" />Pre-cita
                </span>
                <span className="text-gray-600">Disponible como formulario pre-cita para pacientes</span>
              </div>
            </div>
          </div>
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

        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Cómo llegan los formularios</p>
            <p className="text-xs text-gray-600 mb-2">
              El flujo comienza en la página de <strong>Citas</strong>: el botón morado <Btn color="bg-purple-100 text-purple-700">Formulario</Btn> en una cita agendada genera un link único que se comparte con el paciente. Cuando el paciente lo llena y envía, aparece aquí.
            </p>
          </div>

          <div className="space-y-0">
            <WorkflowStep number={1} title="Localizar el formulario">
              La tabla muestra: nombre del paciente, email, fecha de la cita, plantilla usada y timestamp de recepción.
            </WorkflowStep>
            <WorkflowStep number={2} title="Ver y adjuntar" icon={ClipboardList}>
              Clic en el botón morado <Btn color="bg-purple-100 text-purple-700">Ver y adjuntar →</Btn> para abrir las respuestas. Desde esa pantalla puedes ver todos los campos llenados por el paciente y adjuntar la información a su expediente.
            </WorkflowStep>
          </div>

          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-800">
            <strong>Nota:</strong> Para que una plantilla aparezca como opción al enviar el formulario pre-cita, debe tener el flag <Tag>Pre-cita</Tag> activado en la configuración de la plantilla.
          </div>
        </div>
      </SectionAccordion>

    </div>
  );
}
