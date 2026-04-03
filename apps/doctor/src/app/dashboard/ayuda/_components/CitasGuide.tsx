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
  Lock,
  Unlock,
  User,
  MapPin,
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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

        {/* Per-slot buttons */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Botones por horario (dentro de cada tarjeta de slot)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                btn: <Btn color="bg-green-600 text-white">Agendar</Btn>,
                desc: "Reserva este horario para un paciente. Se desactiva si el slot está cerrado o lleno.",
              },
              {
                btn: <><Btn color="bg-blue-100 text-blue-700"><Unlock className="w-3 h-3" />Abrir</Btn>{" "}<Btn color="bg-gray-100 text-gray-700"><Lock className="w-3 h-3" />Cerrar</Btn></>,
                desc: "Abre o cierra la disponibilidad del horario para reservas desde la app pública.",
              },
              {
                btn: <Btn color="bg-red-50 text-red-600"><Trash2 className="w-3 h-3" />Eliminar</Btn>,
                desc: "Elimina el horario. Solo funciona si no hay citas activas en él.",
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

        {/* Bulk actions */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-2">Acciones en bloque (selección múltiple)</p>
          <p className="text-xs text-gray-500 mb-2">
            En ambas vistas puedes marcar varios horarios con el checkbox. Al seleccionar al menos uno aparece la barra de acciones:
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn color="bg-green-100 text-green-700">Abrir</Btn>
            <Btn color="bg-gray-100 text-gray-700">Cerrar</Btn>
            <Btn color="bg-red-100 text-red-700">Eliminar</Btn>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            "Seleccionar todos" y "Deseleccionar todos" aparecen en el encabezado del panel cuando hay más de un horario visible.
          </p>
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
              label: "Ruta A",
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
              label: "Ruta B1",
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
              label: "Ruta B2",
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

      {/* ── Gestión de citas (tabla) ── */}
      <SectionAccordion
        title="Tabla de citas — filtros y navegación"
        subtitle="Buscar, filtrar, ordenar y navegar tus reservaciones"
        icon={User}
        accentColor="blue"
      >
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-800 mb-2">Filtros disponibles</p>
            <ul className="space-y-1.5">
              {[
                "Fecha: navega con las flechas ◀ ▶ o escribe una fecha. Clic en "Todas" para ver todas las fechas.",
                "Paciente: búsqueda por nombre o email (coincidencia parcial, sin importar mayúsculas).",
                "Estado: Activas (Pendiente + Agendada), Todos los estados, o un estado específico.",
                "Limpiar filtros: aparece cuando hay algún filtro activo.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-800 mb-2">Ordenamiento</p>
            <p>Clic en las columnas <strong>PACIENTE</strong>, <strong>FECHA Y HORA</strong> o <strong>ESTADO</strong> para ordenar. Un segundo clic invierte el orden (asc ↔ desc).</p>
            <p className="mt-1 text-xs text-gray-500">El orden por defecto es por estado: Pendiente → Agendada → Vencida → Completada → No asistió → Cancelada.</p>
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
                <p className="text-blue-700">Estado → Agendada. Debes enviar el email manualmente con el botón "Correo" o "Enviar Meet" que aparece en la fila.</p>
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
