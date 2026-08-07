"use client";

import { useState, useEffect } from "react";
import { User, Mail, Phone, MessageSquare, Stethoscope, UserSquare2, X, Lock, MapPin } from "lucide-react";
import { InlinePatientSearch } from "../InlinePatientSearch";

interface DoctorService {
  id: string;
  serviceName: string;
  durationMinutes: number;
  price: number | null;
}

export interface PatientFormData {
  /**
   * Nombre y apellidos POR SEPARADO. Se capturan en dos campos porque el expediente los guarda
   * separados: con un solo campo había que adivinar dónde termina uno y empieza el otro al crear
   * el expediente desde la cita (se partía en el primer espacio ⇒ "Juan Carlos García López"
   * daba nombre "Juan" y apellidos "Carlos García López").
   * `patientName` de la CITA se sigue mandando como la concatenación de ambos: es lo que leen los
   * correos, el agente, el widget público, la fila y el link de pago.
   */
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone: string;
  patientWhatsapp: string;
  notes: string;
}

export interface PatientFieldSettings {
  emailRequired: boolean;
  phoneRequired: boolean;
  whatsappRequired: boolean;
}

interface Props {
  services: DoctorService[];
  selectedServiceId: string | null;
  onSelectService: (id: string) => void;
  /** When true, show selected service as read-only (e.g., range mode where service drives time calculation) */
  serviceReadOnly?: boolean;
  isFirstTime: boolean | null;
  setIsFirstTime: (v: boolean | null) => void;
  appointmentMode: "PRESENCIAL" | "TELEMEDICINA" | null;
  setAppointmentMode: (v: "PRESENCIAL" | "TELEMEDICINA" | null) => void;
  formData: PatientFormData;
  setFormData: (f: PatientFormData) => void;
  error: string;
  fieldSettings?: PatientFieldSettings;
  selectedPatientId: string | null;
  selectedPatientName: string;
  onSelectPatient: (patient: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null) => void;
  /**
   * Lo que el EXPEDIENTE traía al seleccionarlo. Se bloquea SOLO lo que tiene valor: si el
   * expediente no tiene correo no hay nada que proteger y el campo debe seguir escribible
   * (si no, con `emailRequired` activo el doctor quedaría atrapado sin poder capturarlo).
   * WhatsApp nunca se bloquea: el modelo Patient NO tiene esa columna, así que la cita es
   * el único lugar donde ese número existe.
   */
  datosDelExpediente: { firstName: string; lastName: string; email: string; phone: string } | null;
  /**
   * ¿Este flujo registra el consultorio EN LA CITA? Sólo el de rangos. Las ramas de slot tienen
   * su propio selector en `SlotPickerStep` y guardan el consultorio en el SLOT, no en la cita
   * (camino obsoleto — CONSULTORIOS `01-ESTADO` §5); sin esta condición el doctor vería dos
   * selectores de consultorio en el mismo modal.
   */
  pedirConsultorio: boolean;
  /** Consultorios del doctor, en el ORDEN de Editar Perfil (`displayOrder`). El [0] es el de arriba. */
  clinicLocations: Array<{ id: string; name: string; address?: string | null }>;
  /** `true` = la lista no se pudo cargar (≠ "no tiene consultorios"). */
  clinicLocationsError?: boolean;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string) => void;
  /**
   * El consultorio que la cita HEREDA del rango que contiene la hora elegida, o `null` si la
   * hora cae fuera de todo rango. Cuando trae valor no se pregunta nada: sólo se enseña.
   * Lo decide el ID del rango, no el nombre — ver `consultorioHeredadoId` en el padre.
   */
  consultorioHeredado: { nombre: string } | null;
}

export function PatientFormStep({
  services,
  selectedServiceId,
  onSelectService,
  serviceReadOnly = false,
  isFirstTime,
  setIsFirstTime,
  appointmentMode,
  setAppointmentMode,
  formData,
  setFormData,
  error,
  fieldSettings = { emailRequired: true, phoneRequired: true, whatsappRequired: true },
  selectedPatientId,
  selectedPatientName,
  onSelectPatient,
  datosDelExpediente,
  pedirConsultorio,
  clinicLocations,
  clinicLocationsError = false,
  selectedLocationId,
  setSelectedLocationId,
  consultorioHeredado,
}: Props) {
  // Escape del candado. Se reinicia al cambiar de paciente para que desbloquear a uno no
  // deje abierto al siguiente.
  const [contactoDesbloqueado, setContactoDesbloqueado] = useState(false);
  useEffect(() => { setContactoDesbloqueado(false); }, [selectedPatientId]);

  // "Editar" libera SOLO el contacto, porque solo el contacto se sincroniza de vuelta.
  const contactoBloqueado = (valor: string | undefined) =>
    !!selectedPatientId && !contactoDesbloqueado && !!valor;
  const emailBloqueado = contactoBloqueado(datosDelExpediente?.email);
  const telBloqueado = contactoBloqueado(datosDelExpediente?.phone);
  const hayContactoBloqueado = emailBloqueado || telBloqueado;

  // El NOMBRE no se desbloquea nunca: con paciente vinculado, el expediente es su dueño.
  // Editarlo aquí solo desalinearía la cita del expediente y no hay write-back (verificado en
  // vivo — una cita quedó como "Gerardo Lopezzzz" mientras el expediente seguía en "Gerardo
  // Lopez"). Se cambia en el expediente, que es donde vive.
  // Ahora son dos campos, y cada uno se bloquea SOLO si el expediente lo trae: un expediente con
  // apellidos vacíos debe dejar capturarlos aquí en vez de atrapar al doctor con un campo
  // requerido y de solo lectura.
  const nombreBloqueado   = !!selectedPatientId && !!datosDelExpediente?.firstName;
  const apellidoBloqueado = !!selectedPatientId && !!datosDelExpediente?.lastName;
  const claseBloqueada = "bg-gray-50 text-gray-600 cursor-not-allowed";

  return (
    <div className="space-y-4">
      {services.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Servicio *</label>
          {serviceReadOnly ? (
            // Read-only: show selected service as a static badge
            (() => {
              const svc = services.find((s) => s.id === selectedServiceId);
              return svc ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500 bg-blue-50 ring-1 ring-blue-500">
                  <div className="flex items-center gap-2.5">
                    <Stethoscope className="w-4 h-4 shrink-0 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{svc.serviceName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {svc.durationMinutes && (
                      <span className="text-xs text-gray-400">{svc.durationMinutes} min</span>
                    )}
                    {svc.price != null && (
                      <span className="text-xs font-semibold text-gray-700">${svc.price}</span>
                    )}
                  </div>
                </div>
              ) : null;
            })()
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {services.map((svc) => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => onSelectService(svc.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                    selectedServiceId === svc.id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Stethoscope
                      className={`w-4 h-4 shrink-0 ${
                        selectedServiceId === svc.id ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        selectedServiceId === svc.id ? "text-blue-900" : "text-gray-800"
                      }`}
                    >
                      {svc.serviceName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {svc.durationMinutes && (
                      <span className="text-xs text-gray-400">{svc.durationMinutes} min</span>
                    )}
                    {svc.price != null && (
                      <span className="text-xs font-semibold text-gray-700">${svc.price}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tipo de visita */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de visita *</label>
        <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
          {([{ val: true, label: "Primera vez" }, { val: false, label: "Recurrente" }] as const).map(
            ({ val, label }) => (
              <button
                key={label}
                type="button"
                // Cambiar a "Primera vez" DESVINCULA. Sin esto el paciente seguía
                // seleccionado pero su bloque —con la ✕ para soltarlo— desaparecía:
                // quedaban nombre y contacto bloqueados, el aviso hablando de un paciente,
                // y ninguna forma de salir salvo volver a Recurrente. Antes era inofensivo
                // (no había candado); el candado lo volvió una trampa.
                onClick={() => {
                  setIsFirstTime(val);
                  if (val) onSelectPatient(null);
                }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isFirstTime === val
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Vincular expediente (solo en Recurrente).
          Bloque destacado a propósito: para una cita recurrente ESTE es el paso principal
          —trae los datos del paciente y liga la cita a su historial— y como campo suelto
          se saltaba. Se quitó el "(opcional)" por lo mismo.
          ⚠️ Sigue sin ser obligatorio: se puede agendar sin vincular. Si algún día debe
          serlo, el cambio va en la validación del submit, no solo en la etiqueta.
          El resaltado solo aplica mientras falta elegir: es ahí donde hay que llamar la
          atención. Ya con paciente el recuadro se vuelve neutro para que la tarjeta azul
          de adentro se lea — azul sobre azul se empastaba.
          Se muestra TAMBIÉN con "Primera vez" si ya hay paciente vinculado: en prod hay 36
          citas marcadas primera-vez CON expediente, y al reagendar una de ésas el candado
          se activa. Sin este caso el doctor vería nombre y contacto bloqueados y un aviso
          nombrando a un paciente cuya tarjeta —y cuya ✕— estaban ocultas. */}
      {(isFirstTime === false || selectedPatientId) && (
        <div
          className={`rounded-lg border-2 p-3 ${
            selectedPatientId ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-blue-50/40"
          }`}
        >
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
            <UserSquare2 className="w-4 h-4 text-blue-600" />
            Vincular expediente
          </label>
          {/* La pista solo aplica mientras falta buscar: con paciente ya elegido decía
              "busca al paciente" justo encima de su tarjeta. */}
          {!selectedPatientId && (
            <p className="text-xs text-gray-500 mb-2">
              Busca al paciente para traer sus datos y ligar la cita a su historial.
            </p>
          )}
          {selectedPatientId ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50">
              <UserSquare2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-sm text-blue-800 flex-1">{selectedPatientName}</span>
              <button
                type="button"
                onClick={() => onSelectPatient(null)}
                className="p-0.5 rounded hover:bg-blue-100"
              >
                <X className="w-3.5 h-3.5 text-blue-500" />
              </button>
            </div>
          ) : (
            <InlinePatientSearch
              onSelect={(p) => onSelectPatient(p)}
            />
          )}
        </div>
      )}

      {/* Modalidad — después de saber QUIÉN es el paciente: servicio → quién → cómo se contacta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Modalidad *</label>
        <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
          {(
            [
              { val: "PRESENCIAL", label: "Presencial" },
              { val: "TELEMEDICINA", label: "Telemedicina" },
            ] as const
          ).map(({ val, label }) => (
            <button
              key={val}
              type="button"
              onClick={() => setAppointmentMode(val)}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                appointmentMode === val
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Consultorio — sólo cuando hay algo que ELEGIR de verdad.
          Se muestra si el doctor tiene 2+ consultorios Y la hora elegida NO cae dentro de un
          rango: cuando cae, el rango ya dice cuál es y el servidor lo hereda solo — preguntar
          algo cuya respuesta ya se conoce es ruido. Con un solo consultorio no hay pregunta.
          Va aquí, después de Modalidad, porque es la última cosa del "cómo/dónde" de la cita. */}
      {pedirConsultorio && clinicLocations.length > 1 && !consultorioHeredado && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Consultorio *</label>
          <div className="space-y-1.5">
            {clinicLocations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocationId(loc.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  selectedLocationId === loc.id
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="block text-sm font-medium text-gray-900">{loc.name}</span>
                {loc.address && (
                  <span className="block text-xs text-gray-500 mt-0.5">{loc.address}</span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Esta hora no está dentro de ninguno de tus rangos, así que no hay de dónde deducir el
            consultorio.
          </p>
        </div>
      )}

      {/* Cuando SÍ se hereda, se ENSEÑA sin preguntar: el doctor tiene que poder ver dónde
          quedó la cita antes de crearla. Callarlo del todo dejaría el dato correcto e
          invisible, que es la mitad del problema que esta feature vino a resolver. */}
      {pedirConsultorio && clinicLocations.length > 1 && consultorioHeredado && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-600">
            Consultorio: <span className="font-medium text-gray-900">{consultorioHeredado.nombre}</span>
            <span className="block text-gray-500">Se toma del rango que contiene esta hora.</span>
          </p>
        </div>
      )}

      {/* No se pudo saber cuáles son sus consultorios. Se DICE, en vez de comportarse como si no
          tuviera ninguno: sin esto la cita se guarda sin consultorio y el doctor no se entera.
          No bloquea el agendado — la cita importa más que el dato — pero deja de ser silencioso. */}
      {pedirConsultorio && clinicLocationsError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
          <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            No se pudieron cargar tus consultorios.
            <span className="block">
              La cita se creará normalmente, pero quedará <strong>sin consultorio registrado</strong>.
              Recarga la página si quieres elegirlo.
            </span>
          </p>
        </div>
      )}

      {/* Aviso — pegado a los campos que describe, no suelto arriba.
          Se muestra con CUALQUIER paciente seleccionado, no solo cuando hay algo
          bloqueado: si el expediente venía sin correo el campo queda escribible, y lo que
          el doctor teclee SÍ se guarda en el expediente. Sin este aviso esa escritura
          sería silenciosa.
          Habla SOLO de correo y teléfono: el nombre también se bloquea, pero NO se
          sincroniza de vuelta (Patient guarda firstName/lastName por separado y partir un
          nombre completo es adivinar). Prometer que "todo" se guarda sería mentira. */}
      {selectedPatientId && datosDelExpediente && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
          <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 flex-1">
            {hayContactoBloqueado ? (
              <>
                Estos datos vienen del expediente de {selectedPatientName}.{" "}
                <button
                  type="button"
                  onClick={() => setContactoDesbloqueado(true)}
                  className="font-semibold underline hover:text-blue-900"
                >
                  Editar contacto
                </button>{" "}
              </>
            ) : (
              <>Estás agendando para {selectedPatientName}. </>
            )}
            El correo y el teléfono que captures se guardan también en su expediente; el
            nombre solo se cambia desde ahí.
          </p>
        </div>
      )}

      {/* Nombre y apellidos SEPARADOS — el expediente los guarda así. Con un solo campo, crear
          el expediente desde la cita obligaba a adivinar dónde parte el nombre completo.
          En móvil se apilan (grid-cols-1) porque dos campos de texto en 360px quedan ilegibles. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre(s) *</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            {/* Sin autoFocus: el navegador lo desplazaba a la vista al abrir el modal y
                empujaba Servicio y Tipo de visita arriba del pliegue — de ahí el "hay que
                hacer scroll para arriba para ver los botones". */}
            <input
              type="text"
              required
              readOnly={nombreBloqueado}
              value={formData.patientFirstName}
              onChange={(e) => setFormData({ ...formData, patientFirstName: e.target.value })}
              className={`w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${nombreBloqueado ? claseBloqueada : ""}`}
              placeholder="Juan Carlos"
            />
          </div>
        </div>
        <div>
          {/* Apellidos NO es obligatorio. Medido en prod: 124 de 366 citas (34%) tienen un
              patient_name de UNA sola palabra — walk-ins, nombres a medias, lo que el paciente
              dio por teléfono. Con `required` aquí, un tercio de las citas reales dejaría de
              poder agendarse. El expediente sí los exige, pero eso se pide al crearlo, no aquí. */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Apellidos <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              readOnly={apellidoBloqueado}
              value={formData.patientLastName}
              onChange={(e) => setFormData({ ...formData, patientLastName: e.target.value })}
              className={`w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${apellidoBloqueado ? claseBloqueada : ""}`}
              placeholder="García López"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email {fieldSettings.emailRequired ? "*" : <span className="text-gray-400 font-normal">(opcional)</span>}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            required={fieldSettings.emailRequired}
            readOnly={emailBloqueado}
            value={formData.patientEmail}
            onChange={(e) => setFormData({ ...formData, patientEmail: e.target.value })}
            className={`w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${emailBloqueado ? claseBloqueada : ""}`}
            placeholder="juan@email.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono {fieldSettings.phoneRequired ? "*" : <span className="text-gray-400 font-normal">(opcional)</span>}
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            required={fieldSettings.phoneRequired}
            readOnly={telBloqueado}
            value={formData.patientPhone}
            onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })}
            className={`w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${telBloqueado ? claseBloqueada : ""}`}
            placeholder="5512345678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp {fieldSettings.whatsappRequired ? "*" : <span className="text-gray-400 font-normal">(opcional)</span>}
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            required={fieldSettings.whatsappRequired}
            value={formData.patientWhatsapp}
            onChange={(e) => setFormData({ ...formData, patientWhatsapp: e.target.value })}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="5512345678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notas <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <div className="relative">
          <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Motivo de consulta, observaciones..."
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
