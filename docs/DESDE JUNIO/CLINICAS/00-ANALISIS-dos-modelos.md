# CLINICAS — análisis: los dos modelos multi-doctor (clínica vs edificio)

> 🔒 **SNAPSHOT — 2026-09-10.** Análisis de producto/arquitectura, nada construido, ninguna
> decisión comprometida. Nace de la visión de canales conversacionales (2026-09-10): el
> "producto recepcionista" es la tercera pieza de esa visión. Índice: [`README.md`](README.md).

> **Qué es esto.** El SaaS hoy es single-doctor: TODO cuelga de `doctorId` (`Patient.doctorId`,
> bookings, expediente, members). Hay dos formas reales de "muchos doctores en un lugar" en
> México, y **son dos modelos de PROPIEDAD distintos, no dos tamaños del mismo producto**. Este
> doc los separa, los mapea contra el esquema actual, y propone por cuál empezar.

---

## 1. El eje que los separa: de quién es el PACIENTE

| | **Modelo A — CLÍNICA** | **Modelo B — EDIFICIO** |
|---|---|---|
| Pacientes / expediente | De la **clínica**; cualquier doctor acreditado accede a cualquier expediente | De **cada doctor**, jamás compartidos; los doctores ni se conocen |
| Agenda | Por doctor, pero visible a la clínica; vista de calendario clínica-completa | Por doctor; solo la **recepcionista** las ve todas |
| Cliente que paga | La clínica | El edificio / la recepcionista (los doctores pueden no pagar nada) |
| Número IA (voz/WhatsApp) | Scope clínica: agenda entre todos sus doctores | Scope edificio: lista el directorio, agenda con el doctor correcto |
| Doctor notificado por WhatsApp | Sí — y tiene credenciales | Sí — **aunque no tenga cuenta** (solo un teléfono en el sistema) |
| Peso legal | Pesado: dato de salud compartido | Ligero: sin expediente compartido, solo agenda |

## 2. Modelo A (clínica) — está más cerca del esquema actual de lo que parece

### El camino corto: la clínica ES una cuenta con muchos doctores-members

El sistema `DoctorMember` ya da "un tenant, muchos usuarios con credenciales y 19 toggles".
Una clínica puede ser literalmente **una cuenta Doctor cuyos members son los doctores**. Los
pacientes quedan compartidos AUTOMÁTICAMENTE porque todos cuelgan del único `doctorId` — cero
cirugía de esquema en Patient, expediente, facturas, ni en el agente.

Lo que falta es real pero acotado:

- **`Booking` necesita "doctor que atiende"** (¿con QUIÉN es esta cita?).
- **Sub-agendas / disponibilidad por member** (hoy la agenda es de la cuenta, no del member).
- La **vista de calendario clínica-completa**.
- Levantar el cap de Ext A (**máx 1 helper por doctor**, `4666a9d1`).
- `PatientAuditLog` **ya existe** para el rastro de quién-accedió-qué.

### El camino largo: entidad `Organization` arriba de los doctores

Solo se vuelve necesario si los doctores-member necesitan cosas que hoy son por-cuenta-Doctor:
su propio perfil fiscal para facturar con SU RFC, su propio número de WhatsApp, su propio scope
de agente.

**🔑 La pregunta que decide la arquitectura: en la clínica, ¿quién factura — la clínica o cada
doctor?** Si factura la clínica, el camino corto aguanta sorprendentemente lejos.

### La bandera legal (por qué A es el modelo pesado)

Expediente compartido ⇒ la **clínica se vuelve el responsable** ante LFPDPPP, el aviso de
privacidad es de la clínica, y la auditoría por acceso pasa de nice-to-have a obligación. Las
expectativas de NOM-024 también caen sobre la clínica. Y una corrección al pitch original:
"cualquiera accede al expediente" debe ser **"cualquier doctor que la clínica acreditó, con
auditoría por acceso"** — acceso totalmente abierto es exactamente lo que LFPDPPP y el propio
diseño de `PatientAuditLog` empujan a evitar; el sistema de toggles ya da la granularidad.

## 3. Modelo B (edificio) — la recepcionista ES el producto, y es estructuralmente más ligero

La realidad mexicana: un edificio de consultorios con doctores independientes que comparten
UNA recepcionista que les maneja la agenda. Sin pacientes compartidos ⇒ sin peso legal de dato
compartido. El sistema es: una entidad edificio, un usuario recepcionista, y un **directorio de
doctores en dos estados**:

1. **Doctor solo-contacto (sin el SaaS):** nombre, especialidad, consultorio, teléfono. Su
   "agenda" existe solo dentro del sistema del edificio; cada cita nueva dispara una plantilla
   de WhatsApp a su número (WABA de la plataforma + template utility, centavos). **Cada
   notificación es un demo del producto a un doctor no-cliente — ese es el wedge de
   adquisición.**
2. **Doctor conectado (tiene el SaaS):** el edificio se conecta a su agenda real —
   disponibilidad leída en vivo, las citas caen en su calendario de verdad. Dato del esquema:
   **una recepcionista como member agenda-only de N doctores es casi expresable HOY**
   (`DoctorMember` permite a un user tener filas en múltiples doctores). Lo genuinamente nuevo:
   la UX invertida (UN calendario sobre muchos doctores) y el flujo de invitación
   recepcionista→doctor.
3. **Un doctor, múltiples edificios:** mapea directo a la feature de `consultorios` — **pero la
   disponibilidad hoy es global por doctor, no por consultorio** ("martes estoy en el edificio
   X, jueves en el Y" no es representable). Gap real que este producto obliga a cerrar — y que
   beneficia al SaaS actual de inmediato.

## 4. Lo que los DOS modelos comparten (se construye una vez)

- **El canal IA scopeado a una organización** — un TERCER scope de agente además de
  doctor-scoped (el asistente) y patient-scoped (agente WhatsApp): "¿qué doctores hay?",
  "disponibilidad del Dr. X", "agéndame con la dermatóloga". Misma arquitectura de tool layer
  + regla 0, scope nuevo.
- **La política de identidad anti-suplantación** de
  [`../AGENTES/AGENTE ELEVENLABS/00-EXPLORACION-voz-elevenlabs.md`](../AGENTES/AGENTE%20ELEVENLABS/00-EXPLORACION-voz-elevenlabs.md)
  §5 aplica sin cambios: cita nueva sin verificación; tocar una existente sí.
- **Infraestructura de notificación WhatsApp a números arbitrarios** (el corazón de B, la
  conveniencia de A) — sale de la v1 del canal WhatsApp
  ([`../AGENTES/AGENTE WHATSAPP/01-ACTUALIZACION-2026-09-tech-provider.md`](../AGENTES/AGENTE%20WHATSAPP/01-ACTUALIZACION-2026-09-tech-provider.md)).

## 5. Recomendación de secuencia (2026-09-10, propuesta — no decidida)

**Modelo B primero**, aunque A sea más barato en esquema vía el truco de members:

1. B no carga peso legal (no comparte expediente).
2. Su comprador (recepcionista/edificio) **no está servido por nadie** (Doctoralia vende
   marketplace, no operación de edificio).
3. Obliga a cerrar exactamente UN fix que el SaaS necesita de todos modos: **disponibilidad
   por consultorio**.
4. Alimenta la adquisición de doctores (el wedge de notificaciones).

El camino corto de A se prototipa **cuando una clínica real lo pida**, y la compuerta de
decisión es la pregunta de facturación (§2).

**Prerequisitos heredados de la visión de canales:** la v1 de WhatsApp (plantillas + webhook) y
el agente de voz son las piezas que B ensambla — y el hueco de agendar sin rango
(`../CITAS/SESSION-REFRESCO.md`) sigue siendo prerequisito de CUALQUIER agente que agende.

---

*La visión de canales de la que nace esto: [`../AGENTES/AGENTE WHATSAPP/`](../AGENTES/AGENTE%20WHATSAPP/README.md)
(texto) · [`../AGENTES/AGENTE ELEVENLABS/`](../AGENTES/AGENTE%20ELEVENLABS/README.md) (voz).
El sistema de members que el camino corto de A reusa: [`../NUEVOS USUARIOS/`](../NUEVOS%20USUARIOS/README.md).
La feature de consultorios que B extiende: memoria del proyecto en `docs/DESDE JUNIO/CITAS/` y
el modelo vivo en el código.*
