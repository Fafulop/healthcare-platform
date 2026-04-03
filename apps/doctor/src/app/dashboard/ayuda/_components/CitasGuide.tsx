"use client";

import {
  CalendarDays,
  CalendarPlus,
  CalendarOff,
  Globe,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Star,
  Bell,
  LayoutGrid,
  List,
  ArrowRight,
  Info,
  Mail,
} from "lucide-react";
import { SectionAccordion } from "./SectionAccordion";
import { WorkflowStep } from "./WorkflowStep";
import { WorkflowPath } from "./WorkflowPath";
import { AppBadge } from "./AppBadge";

export function CitasGuide() {
  return (
    <div className="space-y-4">
      {/* ── Overview card ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Página de Citas
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Gestiona tu disponibilidad, agenda citas y lleva seguimiento de
              todos tus pacientes programados.
            </p>
          </div>
        </div>

        {/* View modes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <LayoutGrid className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Vista Calendario</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Navega por mes, selecciona un día y ve los horarios disponibles
                y reservaciones del panel lateral.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <List className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Vista Lista</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ve todos tus horarios en formato tabla con filtros por estado
                (abiertos, reservados, bloqueados).
              </p>
            </div>
          </div>
        </div>

        {/* Status badges reference */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Estados de una cita
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
              { label: "Confirmada", color: "bg-blue-100 text-blue-800 border-blue-200" },
              { label: "Completada", color: "bg-green-100 text-green-800 border-green-200" },
              { label: "No-show", color: "bg-orange-100 text-orange-800 border-orange-200" },
              { label: "Cancelada", color: "bg-red-100 text-red-800 border-red-200" },
              { label: "Vencida", color: "bg-gray-100 text-gray-600 border-gray-200" },
            ].map((s) => (
              <span
                key={s.label}
                className={`px-2 py-0.5 rounded-full border font-medium ${s.color}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Configurar disponibilidad ── */}
      <SectionAccordion
        title="Configurar disponibilidad"
        subtitle="Crear horarios y bloquear rangos"
        icon={CalendarPlus}
        accentColor="green"
        defaultOpen
      >
        {/* 2a: Crear horarios */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-semibold text-gray-800">
              Crear horarios
            </p>
            <AppBadge variant="doctor" />
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Abre ventanas de tiempo para que los pacientes puedan reservar. Usa
            el botón{" "}
            <span className="font-medium text-gray-700">"Crear Horarios"</span>{" "}
            en la esquina superior derecha de la página.
          </p>

          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal" icon={CalendarPlus}>
              Clic en el botón <strong>Crear Horarios</strong> (ícono de
              calendario con +).
            </WorkflowStep>
            <WorkflowStep
              number={2}
              title="Elegir tipo de horario"
              icon={CalendarDays}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <p className="font-medium text-gray-800">Día único</p>
                  <p className="text-gray-500 mt-0.5">
                    Selecciona una fecha específica para crear los horarios.
                  </p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                  <p className="font-medium text-gray-800">Patrón recurrente</p>
                  <p className="text-gray-500 mt-0.5">
                    Elige días de la semana (Lun–Dom) y un rango de fechas para
                    repetir.
                  </p>
                </div>
              </div>
            </WorkflowStep>
            <WorkflowStep
              number={3}
              title="Configurar horario"
              icon={Clock}
              tip="Si tienes pausas entre citas (ej. 10 min para notas), activa 'Descanso entre citas'."
            >
              Define hora de inicio, hora de fin y duración de cada cita (30 o
              60 minutos). Opcionalmente activa un tiempo de descanso entre
              citas.
            </WorkflowStep>
            <WorkflowStep number={4} title="Seleccionar consultorio">
              Si tienes más de una ubicación, elige en cuál se realizarán las
              citas. Si solo tienes una, se selecciona automáticamente.
            </WorkflowStep>
            <WorkflowStep number={5} title="Revisar vista previa">
              El sistema muestra cuántos horarios se crearán. Si hay conflictos
              con horarios existentes, se listarán en rojo para que los revises.
            </WorkflowStep>
            <WorkflowStep number={6} title="Confirmar">
              Clic en <strong>Crear</strong>. Los horarios aparecen en el
              calendario de inmediato.
            </WorkflowStep>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {/* 2b: Bloquear rangos */}
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-semibold text-gray-800">
              Bloquear rangos
            </p>
            <AppBadge variant="doctor" />
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Cierra temporalmente tus horarios por vacaciones, días libres u
            otros compromisos. Botón{" "}
            <span className="font-medium text-gray-700">"Bloquear Horarios"</span>.
          </p>

          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal" icon={CalendarOff}>
              Clic en <strong>Bloquear Horarios</strong>.
            </WorkflowStep>
            <WorkflowStep number={2} title="Elegir acción">
              Selecciona <strong>Bloquear</strong> (cerrar horarios) o{" "}
              <strong>Desbloquear</strong> (reabrir horarios previamente
              cerrados).
            </WorkflowStep>
            <WorkflowStep number={3} title="Definir rango de fechas">
              Ingresa fecha de inicio y fin. Opcionalmente filtra por rango de
              hora si solo quieres bloquear cierta franja del día.
            </WorkflowStep>
            <WorkflowStep
              number={4}
              title="Ver vista previa"
              tip="Los horarios con citas activas (Pendiente o Confirmada) NO se bloquearán automáticamente — aparecen en amarillo en la previsualización."
            >
              El sistema muestra en verde los horarios que cambiarán y en
              amarillo los que se omitirán por tener citas activas.
            </WorkflowStep>
            <WorkflowStep number={5} title="Confirmar">
              Clic en <strong>Aplicar</strong>. Los horarios afectados se
              actualizan de inmediato.
            </WorkflowStep>
          </div>
        </div>
      </SectionAccordion>

      {/* ── Section 3: Cómo se agenda una cita ── */}
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
                'Clic en "Agendar Cita" (botón en hero o barra lateral)',
                "Selecciona fecha disponible en el calendario",
                "Elige el horario y completa sus datos",
                "Cita creada con estado PENDIENTE",
                "Tú recibes notificación → debes confirmar",
              ],
              note:
                "El paciente puede cancelar desde el enlace en su email de confirmación.",
            },
            {
              badge: "doctor",
              label: "Ruta B1",
              title: "Doctor agenda en horario existente",
              accentColor: "gray",
              steps: [
                'Clic en "Agendar Cita" en la página de citas',
                "Selecciona un horario abierto del listado",
                "Llena los datos del paciente",
                "Confirma — cita queda CONFIRMADA de inmediato",
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
                "Confirma — el horario y la cita se crean juntos",
                "Email de confirmación se envía automáticamente",
              ],
              note:
                "Útil para citas de urgencia o fuera de tu disponibilidad habitual.",
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

      {/* ── Section 4: Gestión de citas pendientes ── */}
      <SectionAccordion
        title="Gestión de citas pendientes"
        subtitle="Confirmar o rechazar citas agendadas desde la app pública"
        icon={Clock}
        accentColor="amber"
      >
        <div className="flex items-center gap-2 mb-1">
          <AppBadge variant="doctor" />
          <p className="text-xs text-gray-500">
            Las citas pendientes aparecen en la tabla "Reservaciones" con badge
            amarillo.
          </p>
        </div>

        <div className="space-y-0 mt-3">
          <WorkflowStep number={1} title="Identificar citas pendientes" icon={Clock}>
            En la sección <strong>Reservaciones</strong> (parte inferior de la
            página), busca las citas con estado{" "}
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800 font-medium">
              Pendiente
            </span>
            . También aparece el contador en las tarjetas de estadísticas en la
            parte superior.
          </WorkflowStep>
          <WorkflowStep
            number={2}
            title="Ver detalle de la cita"
            icon={FileText}
          >
            Haz clic en la fila de la cita para expandir sus detalles: nombre,
            contacto, servicio, modalidad y hora.
          </WorkflowStep>
          <WorkflowStep
            number={3}
            title="Confirmar o cancelar"
            icon={CheckCircle2}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-green-50 rounded-lg border border-green-200 text-xs">
                <p className="font-semibold text-green-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Confirmar
                </p>
                <p className="text-green-700 mt-0.5">
                  Estado → CONFIRMADA. Se envía email de confirmación al
                  paciente. Si es telemedicina, se incluye el Meet link.
                </p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg border border-red-200 text-xs">
                <p className="font-semibold text-red-800 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Cancelar
                </p>
                <p className="text-red-700 mt-0.5">
                  Estado → CANCELADA. Se notifica al paciente por email.
                </p>
              </div>
            </div>
          </WorkflowStep>
        </div>

        {/* Status transitions */}
        <div className="mt-2 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Transiciones de estado disponibles
          </p>
          <div className="space-y-2 text-sm">
            {[
              {
                from: "Pendiente",
                to: "Confirmada",
                fromColor: "bg-yellow-100 text-yellow-800",
                toColor: "bg-blue-100 text-blue-800",
              },
              {
                from: "Pendiente",
                to: "Cancelada",
                fromColor: "bg-yellow-100 text-yellow-800",
                toColor: "bg-red-100 text-red-800",
              },
              {
                from: "Confirmada",
                to: "Completada",
                fromColor: "bg-blue-100 text-blue-800",
                toColor: "bg-green-100 text-green-800",
              },
              {
                from: "Confirmada",
                to: "No-show",
                fromColor: "bg-blue-100 text-blue-800",
                toColor: "bg-orange-100 text-orange-800",
              },
              {
                from: "Confirmada",
                to: "Cancelada",
                fromColor: "bg-blue-100 text-blue-800",
                toColor: "bg-red-100 text-red-800",
              },
            ].map((t) => (
              <div key={`${t.from}-${t.to}`} className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.fromColor}`}
                >
                  {t.from}
                </span>
                <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.toColor}`}
                >
                  {t.to}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ── Section 5: Acciones sobre una cita ── */}
      <SectionAccordion
        title="Acciones sobre una cita confirmada"
        subtitle="Formulario pre-consulta y link de reseña"
        icon={Stethoscope}
        accentColor="purple"
      >
        {/* Pre-appointment form */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              Enviar formulario pre-consulta
            </p>
            <AppBadge variant="doctor" />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Recopila información del paciente antes de la cita. El paciente
            llena el formulario en la app pública desde un link único.
          </p>

          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal" icon={Mail}>
              En la fila de la cita, clic en el ícono de sobre (
              <FileText className="w-3 h-3 inline" />
              ).
            </WorkflowStep>
            <WorkflowStep number={2} title="Seleccionar plantilla">
              Si tienes plantillas configuradas, selecciona la que aplica. Si no
              tienes plantillas, el modal te dirigirá a crearlas.
            </WorkflowStep>
            <WorkflowStep number={3} title="Compartir el link">
              Copia el link o envíalo directamente por WhatsApp. El paciente
              llena el formulario en{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">
                /formulario-cita/[token]
              </code>
              .
            </WorkflowStep>
            <WorkflowStep
              number={4}
              title="Verificar completado"
              tip="Puedes ver las respuestas del formulario desde el modal — el ícono cambia a un check verde cuando el paciente ya lo llenó."
            >
              Cuando el paciente envía el formulario, el modal muestra un
              checkmark de confirmación y un link para ver las respuestas.
            </WorkflowStep>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {/* Review link */}
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <Star className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              Generar link de reseña
            </p>
            <AppBadge variant="doctor" />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Solicita una reseña al paciente después de la consulta. El link es
            único y lleva a una página de calificación en la app pública.
          </p>

          <div className="space-y-0">
            <WorkflowStep number={1} title="Abrir el modal" icon={Star}>
              En la fila de la cita, clic en el ícono de estrella.
            </WorkflowStep>
            <WorkflowStep number={2} title="Nombre del paciente (opcional)">
              Escribe el nombre para personalizar la página de reseña. Puedes
              dejarlo vacío.
            </WorkflowStep>
            <WorkflowStep number={3} title="Generar link">
              Clic en <strong>Generar Link</strong>. El link aparece en una caja
              de texto lista para copiar.
            </WorkflowStep>
            <WorkflowStep
              number={4}
              title="Compartir"
              tip="Puedes generar múltiples links y compartirlos por cualquier canal. Cada link es único."
            >
              Usa el botón de copiar o comparte directo por WhatsApp. El
              paciente deja su reseña en{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">
                /review/[token]
              </code>
              .
            </WorkflowStep>
          </div>
        </div>
      </SectionAccordion>

      {/* ── Section 6: Recordatorios automáticos ── */}
      <SectionAccordion
        title="Recordatorios automáticos"
        subtitle="Notificación por email 2 horas antes de la cita"
        icon={Bell}
        accentColor="blue"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              El toggle de recordatorios se encuentra en la barra superior de la
              página de Citas (ícono de campana). Cuando está{" "}
              <strong>activado</strong>:
            </p>
            <ul className="space-y-1.5 ml-2">
              {[
                "Se envía un email automático al paciente 2 horas antes de su cita confirmada.",
                "El email incluye: nombre del doctor, hora de la cita, dirección del consultorio.",
                "Para citas de telemedicina: se incluye el Meet link en el recordatorio.",
                "Esta configuración aplica a todos tus pacientes activos.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <ArrowRight className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <strong>Nota:</strong> El estado del toggle se guarda por doctor.
              No necesitas activarlo cada vez que entras a la página.
            </div>
          </div>
        </div>
      </SectionAccordion>
    </div>
  );
}
