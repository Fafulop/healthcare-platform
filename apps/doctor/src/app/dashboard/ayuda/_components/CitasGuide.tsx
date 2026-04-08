"use client";

import { type ReactNode } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarClock,
  Clock,
  CheckCircle2,
  FileText,
  Star,
  Bell,
  LayoutGrid,
  List,
  ArrowRight,
  Info,
  Mail,
  Send,
  Video,
  Plus,
  Ban,
  Trash2,
  User,
  MapPin,
  XCircle,
  UserX,
  CheckCheck,
  RefreshCw,
  Filter,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { SectionAccordion } from "./SectionAccordion";
import { WorkflowStep } from "./WorkflowStep";
import { WorkflowPath } from "./WorkflowPath";
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

export function CitasGuide() {
  return (
    <div className="space-y-4">

      {/* ── Overview ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Página de Citas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona tu disponibilidad, agenda citas y lleva seguimiento de todos tus pacientes programados.
            </p>
          </div>
        </div>

        {/* View modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <LayoutGrid className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Vista Calendario</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Navega por mes, selecciona un día y ve los horarios en el panel lateral derecho.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <List className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Vista Lista</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ve todos tus horarios en tabla. Filtra por estado o cambia entre "Filtrar por fecha" y "Todos los horarios".
              </p>
            </div>
          </div>
        </div>

        {/* Status reference */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Estados de una cita
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Pendiente", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
              { label: "Agendada", color: "bg-blue-100 text-blue-700 border-blue-200" },
              { label: "Completada", color: "bg-green-100 text-green-700 border-green-200" },
              { label: "No asistió", color: "bg-orange-100 text-orange-700 border-orange-200" },
              { label: "Cancelada", color: "bg-red-100 text-red-700 border-red-200" },
              { label: "Vencida", color: "bg-red-100 text-red-800 border-red-300" },
            ].map((s) => (
              <span key={s.label} className={`px-2 py-0.5 rounded-full border font-medium ${s.color}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <SectionAccordion
        title="Tarjetas de resumen: Pendientes · Agendadas · Vencidas"
        subtitle="Los tres contadores en la parte superior de la página y qué significan"
        icon={LayoutGrid}
        accentColor="gray"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {/* Pendientes */}
          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-yellow-800">Pendientes</p>
            </div>
            <p className="text-xs text-yellow-700 leading-relaxed">
              Citas solicitadas por un paciente desde la <strong>app pública</strong> que aún <strong>no has confirmado</strong>.
              El paciente eligió un horario y completó sus datos, pero la cita queda en espera hasta que tú la apruebes o canceles.
              Cada nueva solicitud incrementa este contador.
            </p>
            <p className="text-xs text-yellow-600 font-semibold mt-auto pt-1 border-t border-yellow-200">
              Requieren acción tuya: confirmar o cancelar
            </p>
          </div>

          {/* Agendadas */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-blue-800">Agendadas</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              Citas ya <strong>confirmadas con fecha y hora futura</strong>. Pueden llegar a este estado de tres formas:
              confirmando una cita Pendiente, agendando directamente desde el consultorio,
              o reagendando una cita existente. Son las citas "listas" en tu agenda.
            </p>
            <p className="text-xs text-blue-600 font-semibold mt-auto pt-1 border-t border-blue-200">
              Todo en orden — solo monitorear
            </p>
          </div>

          {/* Vencidas */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-200 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-800">Vencidas</p>
            </div>
            <p className="text-xs text-red-700 leading-relaxed">
              Citas cuya <strong>fecha y hora ya pasaron</strong> sin que se registrara el resultado:
              no se marcaron como Completada, No asistió ni Cancelada. El sistema las clasifica
              automáticamente como vencidas. Deben cerrarse manualmente para mantener el historial limpio.
            </p>
            <p className="text-xs text-red-600 font-semibold mt-auto pt-1 border-t border-red-200">
              Pendientes de cierre — actualizar estado
            </p>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-500 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <span>
            Los tres contadores se actualizan automáticamente al entrar a la página y cada vez que cambias el estado de una cita.
            No muestran citas en estados terminales (Completada, Cancelada, No asistió).
          </span>
        </div>
      </SectionAccordion>

      {/* ── Botones principales ── */}
      <SectionAccordion
        title="Referencia de botones principales"
        subtitle="Qué hace cada botón en la barra superior"
        icon={Info}
        accentColor="gray"
        defaultOpen
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              btn: <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Crear Horarios</Btn>,
              desc: "Abre el modal para crear nuevos horarios disponibles (uno o varios días).",
            },
            {
              btn: <Btn color="bg-green-600 text-white"><CalendarPlus className="w-3 h-3" />Agendar Cita</Btn>,
              desc: "Abre el asistente para reservar una cita directamente desde el consultorio.",
            },
            {
              btn: <Btn color="bg-gray-700 text-white"><Ban className="w-3 h-3" />Bloquear Periodo</Btn>,
              desc: "Cierra o reabre horarios en un rango de fechas (vacaciones, días libres).",
            },
            {
              btn: <Btn color="bg-yellow-500 text-white"><Star className="w-3 h-3" />Enlace Reseña</Btn>,
              desc: "Genera un link único para que el paciente deje una reseña en tu perfil público.",
            },
          ].map((item, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <div>{item.btn}</div>
              <p className="text-xs text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>

      </SectionAccordion>

      {/* ── Configurar disponibilidad ── */}
      <SectionAccordion
        title="Configurar disponibilidad"
        subtitle="Crear horarios y bloquear periodos"
        icon={CalendarPlus}
        accentColor="green"
        defaultOpen
      >
        {/* Crear horarios */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Btn color="bg-blue-600 text-white"><Plus className="w-3 h-3" />Crear Horarios</Btn>
            <AppBadge variant="doctor" />
          </div>
          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal">
              Clic en el botón azul <strong>Crear Horarios</strong> en la esquina superior derecha.
            </WorkflowStep>
            <WorkflowStep number={2} title="Elegir tipo de horario" icon={CalendarDays}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <p className="font-medium text-gray-800">Día único</p>
                  <p className="text-gray-500 mt-0.5">Selecciona una fecha específica.</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <p className="font-medium text-gray-800">Patrón recurrente</p>
                  <p className="text-gray-500 mt-0.5">Elige días de semana (Lun–Dom) y rango de fechas.</p>
                </div>
              </div>
            </WorkflowStep>
            <WorkflowStep number={3} title="Configurar horario" icon={Clock}
              tip="Activa 'Descanso entre citas' si necesitas tiempo entre pacientes (ej. 10 min para notas).">
              Hora de inicio, hora de fin, duración (30 o 60 min). Opcionalmente activa descanso entre citas.
            </WorkflowStep>
            <WorkflowStep number={4} title="Seleccionar consultorio" icon={MapPin}>
              Si tienes más de una ubicación, elige en cuál. Con una sola, se selecciona automáticamente.
            </WorkflowStep>
            <WorkflowStep number={5} title="Revisar vista previa">
              El sistema muestra cuántos horarios se crearán. Conflictos con horarios existentes aparecen en rojo.
            </WorkflowStep>
            <WorkflowStep number={6} title="Confirmar">
              Clic en <strong>Crear</strong>. Los horarios aparecen en el calendario de inmediato.
            </WorkflowStep>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {/* Bloquear periodo */}
          <div className="flex items-center gap-2 mb-3">
            <Btn color="bg-gray-700 text-white"><Ban className="w-3 h-3" />Bloquear Periodo</Btn>
            <AppBadge variant="doctor" />
          </div>
          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal">
              Clic en el botón gris oscuro <strong>Bloquear Periodo</strong>.
            </WorkflowStep>
            <WorkflowStep number={2} title="Elegir acción">
              <strong>Bloquear</strong> (cerrar horarios) o <strong>Desbloquear</strong> (reabrir horarios ya cerrados).
            </WorkflowStep>
            <WorkflowStep number={3} title="Definir rango de fechas">
              Fecha de inicio y fin. Opcionalmente filtra por franja horaria dentro del día.
            </WorkflowStep>
            <WorkflowStep number={4} title="Ver vista previa"
              tip="Horarios con citas activas (Pendiente o Agendada) NO se bloquean automáticamente — aparecen en amarillo.">
              Verde = cambiarán. Amarillo = se omiten por tener citas activas.
            </WorkflowStep>
            <WorkflowStep number={5} title="Confirmar">
              Clic en <strong>Aplicar</strong>. Los horarios afectados se actualizan de inmediato.
            </WorkflowStep>
          </div>
        </div>

      </SectionAccordion>

      {/* ── Cómo se agenda una cita ── */}
      <SectionAccordion
        title="Cómo se agenda una cita"
        subtitle="3 rutas posibles: app pública, horario existente, o nuevo horario"
        icon={CalendarDays}
        accentColor="indigo"
        defaultOpen
      >
        <WorkflowPath
          heading="Elige la ruta según el caso"
          paths={[
            {
              badge: "public",
              label: "",
              title: "El paciente agenda desde el perfil público",
              accentColor: "indigo",
              steps: [
                "Paciente visita tu perfil en la app pública",
                'Clic en "Agendar Cita" (hero o barra lateral)',
                "Selecciona fecha disponible en el calendario",
                "Elige el horario y completa sus datos",
                "Cita creada con estado PENDIENTE",
                "Tú recibes notificación → debes confirmar manualmente",
              ],
              note: "El paciente puede cancelar desde el enlace en su email de confirmación.",
            },
            {
              badge: "doctor",
              label: "",
              title: "Doctor agenda en horario existente",
              accentColor: "gray",
              steps: [
                'Clic en el botón verde "Agendar Cita"',
                "Selecciona un horario abierto del listado",
                "Llena los datos del paciente",
                "Confirma — cita queda AGENDADA de inmediato",
                "Email de confirmación se envía automáticamente",
              ],
              note: "Ideal cuando el paciente llama o escribe para apartar un horario ya existente.",
            },
            {
              badge: "doctor",
              label: "",
              title: "Doctor crea horario nuevo al momento",
              accentColor: "gray",
              steps: [
                'Clic en "Agendar Cita" → selecciona "Nuevo horario"',
                "Ingresa fecha y hora personalizadas",
                "Llena los datos del paciente",
                "Confirma — horario y cita se crean juntos",
                "Email de confirmación se envía automáticamente",
              ],
              note: "Útil para citas de urgencia o fuera de tu disponibilidad habitual.",
            },
          ]}
        />

        {/* Patient form fields */}
        <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Datos que se solicitan al agendar (Rutas B1 y B2)
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600">
            {[
              "Nombre completo del paciente",
              "Correo electrónico",
              "Teléfono",
              "WhatsApp (opcional)",
              "Servicio / motivo de consulta",
              "¿Primera vez? (sí / no)",
              "Modalidad: Presencial o Telemedicina",
            ].map((field) => (
              <div key={field} className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span>{field}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Tabla Todas las Citas ── */}
      <SectionAccordion
        title='Tabla "Todas las Citas" — navegación, filtros y ordenamiento'
        subtitle="Cómo ver, filtrar y ordenar todas tus reservaciones"
        icon={Filter}
        accentColor="blue"
      >
        {/* Vista por defecto */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2 mb-4">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
          <span>
            <strong>Por defecto la tabla muestra las citas del día de hoy</strong> con filtro de estado en
            "Activas" (Pendiente + Agendada). Esto es lo primero que ves al entrar a la página de Citas.
          </span>
        </div>

        {/* Navegación de fecha */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Navegación por fecha</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="font-semibold text-gray-800 mb-1">◀ ▶ Flechas</p>
              <p className="text-gray-500">Avanza o retrocede un día a la vez. Útil para revisar la agenda día a día.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="font-semibold text-gray-800 mb-1">Campo de fecha</p>
              <p className="text-gray-500">Escribe o selecciona una fecha específica para saltar directamente a ese día.</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold text-blue-800 mb-1">Botón "Todas"</p>
              <p className="text-blue-600">Quita el filtro de fecha y muestra <strong>todas las citas</strong> sin importar cuándo son. Ideal para buscar una cita específica o ver el historial completo.</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Filtros disponibles</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800">Buscar paciente</p>
                <p className="text-gray-500 mt-0.5">Escribe el nombre o correo del paciente. La búsqueda es parcial y no distingue mayúsculas (ej. "mar" encuentra "María García").</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800">Filtro de estado <span className="font-normal text-gray-400">(desplegable)</span></p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    { label: "Activas", color: "bg-gray-100 text-gray-600", note: "Por defecto — muestra Pendiente + Agendada" },
                    { label: "Todos los estados", color: "bg-gray-100 text-gray-600", note: "Muestra absolutamente todo el historial" },
                    { label: "Pendiente", color: "bg-yellow-100 text-yellow-700" },
                    { label: "Agendada", color: "bg-blue-100 text-blue-700" },
                    { label: "Completada", color: "bg-green-100 text-green-700" },
                    { label: "No asistió", color: "bg-orange-100 text-orange-700" },
                    { label: "Cancelada", color: "bg-red-100 text-red-700" },
                    { label: "Vencida", color: "bg-red-100 text-red-800" },
                  ].map((s) => (
                    <span key={s.label} className={`px-2 py-0.5 rounded-full text-xs font-medium border border-transparent ${s.color}`}>
                      {s.label}
                      {s.note && <span className="text-gray-400 font-normal ml-1">— {s.note}</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <XCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">Botón "Limpiar"</p>
                <p className="text-amber-700 mt-0.5">Aparece automáticamente cuando hay algún filtro activo. Un solo clic restablece la vista al estado por defecto (hoy + Activas).</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ordenamiento por columna */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Ordenamiento por columna</p>
          <p className="text-xs text-gray-600 mb-2">
            Haz clic en el encabezado de cualquiera de estas columnas para ordenar. Un segundo clic invierte el orden (ascendente ↔ descendente).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { col: "PACIENTE", desc: "Orden alfabético por nombre del paciente." },
              { col: "FECHA Y HORA", desc: "Ordena cronológicamente, del más próximo al más lejano o viceversa." },
              { col: "ESTADO", desc: "Agrupa por estado." },
            ].map((c) => (
              <div key={c.col} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="font-semibold text-gray-700 font-mono text-xs mb-1">{c.col}</p>
                <p className="text-gray-500">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Orden por defecto (sin ordenar): Pendiente → Agendada → Vencida → Completada → No asistió → Cancelada.
          </p>
        </div>

        {/* Datos en cada fila */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Información visible en cada fila</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
            {[
              "Nombre completo del paciente",
              "Correo electrónico y teléfono",
              "Servicio o motivo de consulta",
              "Modalidad: Presencial o Telemedicina",
              "Fecha y hora de la cita",
              "Estado actual (badge de color)",
              "Botones de acciones disponibles",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 py-0.5">
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Columna de acciones ── */}
      <SectionAccordion
        title="Columna de acciones — qué hace cada botón"
        subtitle="Guía detallada de cada acción disponible por cita según su estado"
        icon={CheckCircle2}
        accentColor="indigo"
      >
        <p className="text-xs text-gray-500 mb-4">
          Los botones disponibles en cada fila cambian según el <strong>estado actual</strong> de la cita y la <strong>modalidad</strong> (Presencial o Telemedicina). Aquí se explica cada uno en detalle.
        </p>

        <div className="space-y-3">

          {/* Confirmar */}
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-blue-600 text-white"><CheckCircle2 className="w-3 h-3" />Confirmar</Btn>
              <span className="text-xs text-gray-400">Solo en estado</span>
              <Tag>Pendiente</Tag>
            </div>
            <p className="text-xs text-blue-800">
              Aprueba una cita solicitada desde la app pública. El estado cambia a <strong>Agendada</strong>.
            </p>
            <div className="mt-1.5 p-2 bg-blue-100 rounded-lg text-xs text-blue-700 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span><strong>Importante:</strong> Al confirmar, el sistema <strong>envía automáticamente el email de confirmación</strong> al paciente. El botón aparecerá directamente como <strong>Reenviar</strong> (o <strong>Reenviar Meet</strong> en telemedicina) en caso de que necesites enviarlo de nuevo.</span>
            </div>
          </div>

          {/* Completar */}
          <div className="p-3 rounded-xl border border-green-200 bg-green-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-green-600 text-white"><CheckCheck className="w-3 h-3" />Completar</Btn>
              <span className="text-xs text-gray-400">Disponible en</span>
              <Tag>Pendiente</Tag>
              <Tag>Agendada</Tag>
              <Tag>Vencida</Tag>
            </div>
            <p className="text-xs text-green-800">
              Registra que la consulta se <strong>realizó exitosamente</strong>. El estado cambia a <strong>Completada</strong>.
              Úsalo cuando el paciente asistió y la consulta concluyó. Es un estado terminal: solo se puede eliminar el registro después.
            </p>
          </div>

          {/* No asistió */}
          <div className="p-3 rounded-xl border border-orange-200 bg-orange-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-orange-500 text-white"><UserX className="w-3 h-3" />No asistió</Btn>
              <span className="text-xs text-gray-400">Disponible en</span>
              <Tag>Pendiente</Tag>
              <Tag>Agendada</Tag>
              <Tag>Vencida</Tag>
            </div>
            <p className="text-xs text-orange-800">
              Registra que el paciente <strong>no se presentó</strong> a la cita. El estado cambia a <strong>No asistió</strong>.
              Útil para llevar estadísticas de ausentismo. Es un estado terminal.
            </p>
          </div>

          {/* Cancelar */}
          <div className="p-3 rounded-xl border border-red-200 bg-red-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-red-600 text-white"><XCircle className="w-3 h-3" />Cancelar</Btn>
              <span className="text-xs text-gray-400">Disponible en</span>
              <Tag>Pendiente</Tag>
              <Tag>Agendada</Tag>
            </div>
            <p className="text-xs text-red-800">
              Cancela la cita. Antes de ejecutarse, el sistema pide <strong>confirmación explícita</strong> para evitar cancelaciones accidentales.
              Al confirmar, el estado cambia a <strong>Cancelada</strong> y se envía notificación automática al paciente por email.
              Es un estado terminal.
            </p>
          </div>

          {/* Reagendar */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-amber-500 text-white"><CalendarClock className="w-3 h-3" />Reagendar</Btn>
              <span className="text-xs text-gray-400">Disponible en</span>
              <Tag>Agendada</Tag>
              <Tag>Vencida</Tag>
            </div>
            <p className="text-xs text-amber-800">
              Abre el asistente de agenda con los datos del paciente ya pre-cargados. Permite seleccionar un nuevo horario
              existente o crear uno al momento. Al confirmar, el sistema <strong>cancela automáticamente la cita anterior</strong>,
              crea la nueva cita en estado Agendada y <strong>envía email de confirmación automáticamente</strong> al paciente con el nuevo horario.
            </p>
          </div>

          {/* Correo / Reenviar */}
          <div className="p-3 rounded-xl border border-teal-200 bg-teal-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-teal-100 text-teal-700"><RefreshCw className="w-3 h-3" />Reenviar</Btn>
              <span className="text-xs text-gray-400">estado por defecto · si el email falló:</span>
              <Btn color="bg-teal-600 text-white"><Send className="w-3 h-3" />Correo</Btn>
              <span className="text-xs text-gray-400">Solo en</span>
              <Tag>Agendada</Tag>
              <Tag>Presencial</Tag>
            </div>
            <p className="text-xs text-teal-800">
              El email de confirmación se <strong>envía automáticamente</strong> al agendarse o confirmarse la cita.
              Por eso el botón aparece como <strong>Reenviar</strong> por defecto — úsalo si el paciente no lo recibió.
              El tooltip muestra la fecha y hora del último envío.
            </p>
            <p className="text-xs text-teal-700 mt-1">
              <strong>Correo</strong> aparece únicamente si el envío automático falló por algún motivo técnico (sin tokens de Gmail, etc.).
            </p>
          </div>

          {/* Enviar Meet / Reenviar Meet */}
          <div className="p-3 rounded-xl border border-blue-200 bg-blue-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-blue-100 text-blue-700"><RefreshCw className="w-3 h-3" />Reenviar Meet</Btn>
              <span className="text-xs text-gray-400">estado por defecto · si el email falló:</span>
              <Btn color="bg-blue-600 text-white"><Video className="w-3 h-3" />Enviar Meet</Btn>
              <span className="text-xs text-gray-400">Solo en</span>
              <Tag>Agendada</Tag>
              <Tag>Telemedicina</Tag>
            </div>
            <p className="text-xs text-blue-800">
              Al agendarse o confirmarse una cita de telemedicina, el sistema <strong>crea automáticamente un Google Meet</strong>
              y envía el correo con el link incluido. Por eso el botón aparece como <strong>Reenviar Meet</strong> por defecto.
              El tooltip muestra la fecha del último envío.
            </p>
            <p className="text-xs text-blue-700 mt-1">
              <strong>Reenviar Meet:</strong> Reenvía el correo con el <strong>mismo link de Meet</strong> (no se genera uno nuevo).
            </p>
            <p className="text-xs text-blue-700 mt-1">
              <strong>Enviar Meet:</strong> Aparece si el envío automático falló. Crea el Meet y envía el correo manualmente.
            </p>
            <p className="text-xs text-blue-600 mt-1.5 bg-blue-100 rounded px-2 py-1">
              Si hay un error de permisos de Gmail, aparece un mensaje específico indicando qué autorizar en tu cuenta de Google.
            </p>
          </div>

          {/* Formulario / Recibido */}
          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-purple-600 text-white"><FileText className="w-3 h-3" />Formulario</Btn>
              <span className="text-xs text-gray-400">→ al completarse cambia a:</span>
              <Btn color="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Recibido</Btn>
              <span className="text-xs text-gray-400">Solo en</span>
              <Tag>Agendada</Tag>
            </div>
            <p className="text-xs text-purple-800">
              <strong>Formulario:</strong> Abre un modal para seleccionar una plantilla de formulario pre-consulta.
              Genera un link único que puedes copiar o enviar por WhatsApp. El paciente llena el formulario desde su dispositivo.
              Si no tienes plantillas, el modal te redirige a crearlas en la sección de Expedientes.
            </p>
            <p className="text-xs text-purple-700 mt-1">
              <strong>Recibido (verde):</strong> Aparece automáticamente cuando el paciente envió el formulario.
              Funciona como un acceso directo a las respuestas dentro de la sección de Expedientes.
            </p>
          </div>

          {/* Eliminar */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>
              <span className="text-xs text-gray-400">Solo en estados terminales:</span>
              <Tag>Completada</Tag>
              <Tag>No asistió</Tag>
              <Tag>Cancelada</Tag>
            </div>
            <p className="text-xs text-gray-700">
              Elimina permanentemente el registro de la cita. Solo está disponible en estados terminales
              (la cita ya no puede cambiar de estado). Pide confirmación antes de ejecutarse.
              Una vez eliminado, el registro no puede recuperarse.
            </p>
          </div>

        </div>

        {/* Resumen visual de disponibilidad */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen: qué botones aparecen según el estado</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-2 font-semibold text-gray-600 rounded-tl-lg">Botón</th>
                  <th className="text-center p-2 font-semibold text-yellow-700">Pendiente</th>
                  <th className="text-center p-2 font-semibold text-blue-700">Agendada</th>
                  <th className="text-center p-2 font-semibold text-red-800">Vencida</th>
                  <th className="text-center p-2 font-semibold text-green-700 rounded-tr-lg">Terminal*</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { btn: "Confirmar", states: [true, false, false, false] },
                  { btn: "Completar", states: [true, true, true, false] },
                  { btn: "No asistió", states: [true, true, true, false] },
                  { btn: "Cancelar", states: [true, true, false, false] },
                  { btn: "Reagendar", states: [false, true, true, false] },
                  { btn: "Correo / Reenviar", states: [false, true, false, false] },
                  { btn: "Enviar Meet / Reenviar Meet", states: [false, true, false, false] },
                  { btn: "Formulario / Recibido", states: [false, true, false, false] },
                  { btn: "Eliminar", states: [false, false, false, true] },
                ].map((row) => (
                  <tr key={row.btn} className="hover:bg-gray-50">
                    <td className="p-2 font-medium text-gray-700">{row.btn}</td>
                    {row.states.map((active, i) => (
                      <td key={i} className="p-2 text-center">
                        {active ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-gray-200">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">* Terminal = Completada, No asistió o Cancelada.</p>
          <p className="text-xs text-gray-400 mt-0.5">Correo/Meet solo aparece en citas Agendadas según la modalidad: Correo para Presencial, Enviar Meet para Telemedicina.</p>
        </div>
      </SectionAccordion>

      {/* ── Estados y acciones disponibles ── */}
      <SectionAccordion
        title="Estados — qué puedes hacer en cada uno"
        subtitle="Acciones disponibles y bloqueadas según el estado actual de la cita"
        icon={CalendarDays}
        accentColor="gray"
      >
        <div className="space-y-3">

          {/* ── PENDIENTE ── */}
          <div className="rounded-xl border border-yellow-200 overflow-hidden">
            <div className="bg-yellow-50 px-4 py-2.5 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">Pendiente</span>
              <span className="text-xs text-yellow-700">Cita solicitada desde la app pública, aún sin confirmar por el doctor</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 space-y-1">
                  <Btn color="bg-blue-600 text-white"><CheckCircle2 className="w-3 h-3" />Confirmar</Btn>
                  <p className="text-blue-700">Cambia el estado a <strong>Agendada</strong>. El horario sigue ocupado. El sistema <strong>envía automáticamente el email de confirmación</strong> al paciente. Una vez confirmada también se habilitan <strong>Reenviar</strong>, <strong>Reagendar</strong> y <strong>Formulario</strong>.</p>
                </div>
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-100 space-y-1">
                  <Btn color="bg-red-600 text-white"><XCircle className="w-3 h-3" />Cancelar</Btn>
                  <p className="text-red-700">Pide confirmación previa. Cambia a <strong>Cancelada</strong> y <strong>el horario vuelve a aparecer disponible</strong> en la app pública. Se envía automáticamente un email al paciente informando que su cita fue cancelada, expresando las disculpas del doctor e indicando que puede comunicarse para cualquier aclaración. Una vez cancelada, el único paso adicional posible es <strong>Eliminar</strong> el registro.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500">
                <AlertTriangle className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                <span><strong>Completar</strong> y <strong>No asistió</strong> aparecen en la fila pero están bloqueados — una cita no puede cerrarse sin confirmarse primero.</span>
              </div>
            </div>
          </div>

          {/* ── AGENDADA ── */}
          <div className="rounded-xl border border-blue-200 overflow-hidden">
            <div className="bg-blue-50 px-4 py-2.5 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">Agendada</span>
              <span className="text-xs text-blue-700">Cita confirmada con fecha futura — es el estado principal de trabajo</span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-green-50 rounded-lg border border-green-100 space-y-1">
                <Btn color="bg-green-600 text-white"><CheckCheck className="w-3 h-3" />Completar</Btn>
                <p className="text-green-700">Registra que la consulta se realizó. Estado → <strong>Completada</strong>. El horario queda liberado. Una vez completada, el único paso adicional posible es <strong>Eliminar</strong> el registro.</p>
              </div>
              <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-100 space-y-1">
                <Btn color="bg-orange-500 text-white"><UserX className="w-3 h-3" />No asistió</Btn>
                <p className="text-orange-700">Registra que el paciente no se presentó. Estado → <strong>No asistió</strong>. El horario queda liberado. Una vez marcada, el único paso adicional posible es <strong>Eliminar</strong> el registro.</p>
              </div>
              <div className="p-2.5 bg-red-50 rounded-lg border border-red-100 space-y-1">
                <Btn color="bg-red-600 text-white"><XCircle className="w-3 h-3" />Cancelar</Btn>
                <p className="text-red-700">Pide confirmación previa. Estado → <strong>Cancelada</strong>. Se envía automáticamente un email al paciente informando que su cita fue cancelada, expresando las disculpas del doctor e indicando que puede comunicarse para cualquier aclaración. El horario vuelve a aparecer disponible en la app pública.</p>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 space-y-1">
                <Btn color="bg-amber-500 text-white"><CalendarClock className="w-3 h-3" />Reagendar</Btn>
                <p className="text-amber-700">Cancela esta cita (horario liberado en app pública) y crea una nueva Agendada en el nuevo horario. Email automático al paciente.</p>
              </div>
              <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-100 space-y-1">
                <Btn color="bg-teal-100 text-teal-700"><RefreshCw className="w-3 h-3" />Reenviar / Reenviar Meet</Btn>
                <p className="text-teal-700">El email ya fue enviado automáticamente. Usa <strong>Reenviar</strong> (presencial) o <strong>Reenviar Meet</strong> (telemedicina) si el paciente no lo recibió.</p>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 space-y-1">
                <Btn color="bg-purple-600 text-white"><FileText className="w-3 h-3" />Formulario</Btn>
                <p className="text-purple-700">Genera link de formulario pre-consulta para enviar al paciente. Cuando lo completa, cambia a <strong>Recibido</strong>.</p>
              </div>
            </div>
          </div>

          {/* ── VENCIDA ── */}
          <div className="rounded-xl border border-red-200 overflow-hidden">
            <div className="bg-red-50 px-4 py-2.5 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">Vencida</span>
              <span className="text-xs text-red-700">Cita cuya fecha y hora ya pasaron sin registrar resultado</span>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-green-50 rounded-lg border border-green-100 space-y-1">
                  <Btn color="bg-green-600 text-white"><CheckCheck className="w-3 h-3" />Completar</Btn>
                  <p className="text-green-700">La consulta sí se realizó aunque no se cerró a tiempo. Estado → <strong>Completada</strong>. El horario queda liberado.</p>
                </div>
                <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-100 space-y-1">
                  <Btn color="bg-orange-500 text-white"><UserX className="w-3 h-3" />No asistió</Btn>
                  <p className="text-orange-700">El paciente no fue y no se registró en su momento. Estado → <strong>No asistió</strong>. El horario queda liberado.</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100 space-y-1">
                  <Btn color="bg-amber-500 text-white"><CalendarClock className="w-3 h-3" />Reagendar</Btn>
                  <p className="text-amber-700">Mueve la cita a una nueva fecha. El horario vencido se libera y se crea una nueva cita <strong>Agendada</strong> en el nuevo horario.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
                <span>Las vencidas requieren cierre manual. <strong>Completar</strong> o <strong>No asistió</strong> son las opciones más comunes; <strong>Reagendar</strong> si el paciente sigue interesado en una nueva fecha.</span>
              </div>
            </div>
          </div>

          {/* ── ESTADOS TERMINALES ── */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">Completada</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">No asistió</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Cancelada</span>
              <span className="text-xs text-gray-500">Estados terminales — la cita ya no puede cambiar</span>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3 text-xs text-gray-600">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1 w-full">
                  <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>
                  <p className="text-gray-500 mt-1">Única acción disponible. Elimina permanentemente el registro de la cita. Pide confirmación antes de ejecutarse.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </SectionAccordion>

      {/* ── Gestión de citas pendientes ── */}
      <SectionAccordion
        title="Confirmar o rechazar citas pendientes"
        subtitle="Citas agendadas desde la app pública — requieren confirmación manual"
        icon={Clock}
        accentColor="amber"
      >
        <div className="flex items-center gap-2 mb-3">
          <AppBadge variant="public" />
          <p className="text-xs text-gray-500">
            Estas citas llegan con estado <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 font-medium">Pendiente</span> y el contador en las tarjetas de estadísticas se actualiza.
          </p>
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Localizar la cita" icon={Clock}>
            En la sección <strong>Todas las Citas</strong>, busca las filas con badge amarillo <Tag>Pendiente</Tag>. El contador en la parte superior también lo indica.
          </WorkflowStep>
          <WorkflowStep number={2} title="Revisar los datos">
            Verifica nombre, contacto, servicio, modalidad y horario en la fila o tarjeta.
          </WorkflowStep>
          <WorkflowStep number={3} title="Elegir acción" icon={CheckCircle2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                <p className="font-semibold text-blue-800 flex items-center gap-1 mb-1">
                  <Btn color="bg-blue-100 text-blue-700">Confirmar</Btn>
                </p>
                <p className="text-blue-700">Estado → Agendada. El sistema <strong>envía automáticamente el email de confirmación</strong> al paciente. El botón en la fila aparece directamente como <strong>Reenviar</strong> (o <strong>Reenviar Meet</strong> para telemedicina).</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg border border-red-200 text-xs">
                <p className="font-semibold text-red-800 flex items-center gap-1 mb-1">
                  <Btn color="bg-red-100 text-red-700">Cancelar</Btn>
                </p>
                <p className="text-red-700">Pide confirmación antes de proceder. Estado → Cancelada. El sistema notifica al paciente.</p>
              </div>
            </div>
          </WorkflowStep>
        </div>

        {/* All status transitions */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Todas las transiciones de estado disponibles
          </p>
          <div className="space-y-2 text-sm">
            {[
              { from: "Pendiente", fromC: "bg-yellow-100 text-yellow-700", to: "Agendada", toC: "bg-blue-100 text-blue-700" },
              { from: "Pendiente", fromC: "bg-yellow-100 text-yellow-700", to: "Completada", toC: "bg-green-100 text-green-700" },
              { from: "Pendiente", fromC: "bg-yellow-100 text-yellow-700", to: "No asistió", toC: "bg-orange-100 text-orange-700" },
              { from: "Pendiente", fromC: "bg-yellow-100 text-yellow-700", to: "Cancelada", toC: "bg-red-100 text-red-700" },
              { from: "Agendada", fromC: "bg-blue-100 text-blue-700", to: "Completada", toC: "bg-green-100 text-green-700" },
              { from: "Agendada", fromC: "bg-blue-100 text-blue-700", to: "No asistió", toC: "bg-orange-100 text-orange-700" },
              { from: "Agendada", fromC: "bg-blue-100 text-blue-700", to: "Cancelada", toC: "bg-red-100 text-red-700" },
            ].map((t) => (
              <div key={`${t.from}-${t.to}`} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.fromC}`}>{t.from}</span>
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.toC}`}>{t.to}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Los estados terminales (Cancelada, Completada, No asistió) solo permiten <Btn color="bg-gray-100 text-gray-600"><Trash2 className="w-3 h-3" />Eliminar</Btn> el registro.
          </p>
        </div>
      </SectionAccordion>

      {/* ── Reagendar ── */}
      <SectionAccordion
        title="Reagendar una cita"
        subtitle="Mover una cita confirmada o vencida a un nuevo horario"
        icon={CalendarClock}
        accentColor="amber"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-amber-100 text-amber-700"><CalendarClock className="w-3 h-3" />Reagendar</Btn>
          <p className="text-xs text-gray-500">
            Aparece únicamente en citas con estado <Tag>Agendada</Tag> o <Tag>Vencida</Tag>.
          </p>
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Clic en Reagendar" icon={CalendarClock}>
            El botón ámbar <strong>Reagendar</strong> abre el mismo asistente que "Agendar Cita", pero con los datos del paciente pre-cargados.
          </WorkflowStep>
          <WorkflowStep number={2} title="Seleccionar nuevo horario">
            Elige un horario disponible existente o crea uno nuevo al momento (igual que Ruta B1 / B2).
          </WorkflowStep>
          <WorkflowStep number={3} title="Confirmar">
            Al confirmar, el sistema:
            <ul className="mt-1.5 space-y-1">
              {[
                "Cancela automáticamente la cita anterior",
                "Crea la nueva cita con estado Agendada",
                "Envía automáticamente un email de confirmación al paciente con el nuevo horario",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-500">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </WorkflowStep>
        </div>
      </SectionAccordion>

      {/* ── Emails y comunicación ── */}
      <SectionAccordion
        title="Correos y comunicación con el paciente"
        subtitle="Envío manual de confirmación, reenvío y Meet para telemedicina"
        icon={Mail}
        accentColor="blue"
      >
        <p className="text-xs text-gray-500 mb-4">
          Estos botones aparecen únicamente en citas con estado <Tag>Agendada</Tag>. Hay dos variantes según la modalidad de la cita.
        </p>

        {/* Presencial */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-800">Cita presencial</p>
            <Tag>Presencial</Tag>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-xs space-y-1">
              <p className="font-semibold text-teal-800 flex items-center gap-1">
                <Send className="w-3 h-3" />
                <Btn color="bg-teal-100 text-teal-700">Correo</Btn>
              </p>
              <p className="text-teal-700">Envía el email de confirmación al paciente (primera vez). Incluye fecha, hora y dirección del consultorio.</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-xs space-y-1">
              <p className="font-semibold text-teal-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <Btn color="bg-teal-100 text-teal-700">Reenviar</Btn>
              </p>
              <p className="text-teal-700">Aparece después del primer envío. El tooltip muestra la fecha y hora del último envío.</p>
            </div>
          </div>
        </div>

        {/* Telemedicina */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-800">Cita de telemedicina</p>
            <Tag>Telemedicina</Tag>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs space-y-1">
              <p className="font-semibold text-blue-800 flex items-center gap-1">
                <Video className="w-3 h-3" />
                <Btn color="bg-blue-100 text-blue-700">Enviar Meet</Btn>
              </p>
              <p className="text-blue-700">Crea automáticamente un Google Meet, guarda el link y envía el correo al paciente con el link incluido.</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs space-y-1">
              <p className="font-semibold text-blue-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <Btn color="bg-blue-100 text-blue-700">Reenviar Meet</Btn>
              </p>
              <p className="text-blue-700">Reenvía el correo con el mismo Meet link. El tooltip muestra el timestamp del último envío.</p>
            </div>
          </div>
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <strong>Nota:</strong> El botón se desactiva mientras el envío está en proceso. Si hay un error de permisos de Gmail, aparece un mensaje específico indicando qué autorizar.
          </div>
        </div>

        {/* Auto-sends */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Envíos automáticos (sin acción del doctor)
          </p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            {[
              "Al agendar desde el doctor (Rutas B1 y B2): email de confirmación inmediato.",
              "Al reagendar: email de confirmación automático con el nuevo horario.",
              "Recordatorio 2 horas antes (si el toggle de campana está activo).",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </SectionAccordion>

      {/* ── Formulario pre-consulta ── */}
      <SectionAccordion
        title="Formulario pre-consulta"
        subtitle="Recopilar información del paciente antes de la cita"
        icon={FileText}
        accentColor="purple"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-purple-100 text-purple-700"><FileText className="w-3 h-3" />Formulario</Btn>
          <p className="text-xs text-gray-500">Solo disponible en citas <Tag>Agendada</Tag></p>
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Abrir el modal" icon={FileText}>
            Clic en el botón morado <strong>Formulario</strong> en la fila de la cita.
          </WorkflowStep>
          <WorkflowStep number={2} title="Seleccionar plantilla">
            Si tienes plantillas configuradas, selecciona la que aplica. Si no tienes plantillas, el modal te dirige a crearlas en Expedientes.
          </WorkflowStep>
          <WorkflowStep number={3} title="Compartir el link">
            Copia el link o envíalo por WhatsApp. El paciente llena el formulario en <code className="text-xs bg-gray-100 px-1 rounded">/formulario-cita/[token]</code>.
          </WorkflowStep>
          <WorkflowStep number={4} title="Verificar completado"
            tip="Una vez enviado, el botón morado cambia a un indicador verde 'Recibido' con link directo a las respuestas.">
            Cuando el paciente envía el formulario, el botón se convierte en:
            <div className="mt-1.5">
              <Btn color="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Recibido</Btn>
              <span className="text-xs text-gray-500 ml-2">→ link directo a las respuestas en Expedientes</span>
            </div>
          </WorkflowStep>
        </div>
      </SectionAccordion>

      {/* ── Link de reseña ── */}
      <SectionAccordion
        title="Generar link de reseña"
        subtitle="Solicitar una reseña pública al paciente tras la consulta"
        icon={Star}
        accentColor="amber"
      >
        <div className="flex items-center gap-2 mb-3">
          <Btn color="bg-yellow-500 text-white"><Star className="w-3 h-3" />Enlace Reseña</Btn>
          <p className="text-xs text-gray-500">Disponible desde el botón amarillo en la barra principal — no requiere seleccionar una cita específica.</p>
        </div>

        <div className="space-y-0">
          <WorkflowStep number={1} title="Abrir el modal" icon={Star}>
            Clic en el botón amarillo <strong>Enlace Reseña</strong>.
          </WorkflowStep>
          <WorkflowStep number={2} title="Nombre del paciente (opcional)">
            Escribe el nombre para personalizar la página de reseña. Puedes dejarlo vacío.
          </WorkflowStep>
          <WorkflowStep number={3} title="Generar link">
            Clic en <strong>Generar Link</strong>. Aparece el link en una caja de texto lista para copiar.
          </WorkflowStep>
          <WorkflowStep number={4} title="Compartir"
            tip="Puedes generar múltiples links distintos. Cada uno es único e independiente.">
            Usa el botón de copiar o comparte directo por WhatsApp. El paciente deja su reseña en <code className="text-xs bg-gray-100 px-1 rounded">/review/[token]</code> de la app pública.
          </WorkflowStep>
        </div>
      </SectionAccordion>

      {/* ── Recordatorios ── */}
      <SectionAccordion
        title="Recordatorios automáticos"
        subtitle="Email automático 2 horas antes de cada cita"
        icon={Bell}
        accentColor="blue"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              El toggle de recordatorios está en la barra de la página de Citas (ícono de campana, junto al título). Cuando está <strong>activado</strong>:
            </p>
            <ul className="space-y-1.5 ml-2">
              {[
                "Se envía un email automático al paciente 2 horas antes de su cita confirmada.",
                "El email incluye: nombre del doctor, hora, dirección del consultorio.",
                "Para citas de telemedicina: se incluye el Google Meet link.",
                "La configuración aplica a todos tus pacientes — no es por cita.",
                "El estado del toggle se guarda en tu perfil (no se reinicia al salir).",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionAccordion>

    </div>
  );
}
