# 📁 CLINICAS — índice

> 🌱 **Carpeta en exploración — nada construido, ninguna decisión comprometida.** Los dos
> modelos multi-doctor de la realidad mexicana: la **CLÍNICA** (pacientes/expediente de la
> clínica, cualquier doctor acreditado accede) y el **EDIFICIO** (doctores independientes que
> comparten solo una recepcionista que les maneja la agenda). Analizado 2026-09-10 como tercera
> pieza de la visión de canales conversacionales (WhatsApp + voz + recepcionista).

## La idea en tres líneas

Son **dos modelos de PROPIEDAD distintos, no dos tamaños del mismo producto**: en la clínica el
paciente es de la organización (peso legal LFPDPPP/NOM-024); en el edificio el paciente sigue
siendo de cada doctor y lo único compartido es la operación de agenda. El eje que decide la
arquitectura del modelo clínica: **¿quién factura — la clínica o cada doctor?**

## Hallazgos clave del análisis

- **Modelo A camino corto:** una clínica puede ser UNA cuenta Doctor cuyos members son los
  doctores (`DoctorMember` ya da credenciales + 19 toggles; los pacientes quedan compartidos
  solos). Falta: "doctor que atiende" en `Booking`, sub-agendas por member, vista de calendario
  clínica, levantar el cap de 1 helper.
- **Modelo B:** la recepcionista es el producto. Directorio de doctores en dos estados
  (solo-contacto = notificación WhatsApp a su teléfono, el wedge de adquisición; conectado =
  agenda real en vivo). Una recepcionista member de N doctores es casi expresable hoy.
- **Gap que B obliga a cerrar y el SaaS necesita igual:** disponibilidad POR CONSULTORIO
  (hoy es global por doctor).
- **Lo que se construye una vez para ambos:** el scope de agente a nivel organización (tercer
  scope: ni doctor ni paciente) y la política de identidad anti-suplantación
  (`../AGENTES/AGENTE ELEVENLABS/00-EXPLORACION-voz-elevenlabs.md` §5).
- **Recomendación (propuesta):** B primero — sin peso legal, comprador sin servir, alimenta
  adquisición. A se prototipa cuando una clínica real lo pida.

## Docs

| Doc | Qué es |
|---|---|
| [`00-ANALISIS-dos-modelos.md`](00-ANALISIS-dos-modelos.md) | 🔒 2026-09-10 · El análisis completo: el eje de propiedad del paciente, los dos caminos del modelo clínica (cuenta-con-members vs `Organization`), la bandera legal, el directorio de dos estados del edificio, lo compartido, y la secuencia propuesta |

*Los canales que este producto ensambla: [`../AGENTES/AGENTE WHATSAPP/`](../AGENTES/AGENTE%20WHATSAPP/README.md)
· [`../AGENTES/AGENTE ELEVENLABS/`](../AGENTES/AGENTE%20ELEVENLABS/README.md).
El sistema de members/permisos que reusa: [`../NUEVOS USUARIOS/`](../NUEVOS%20USUARIOS/README.md).*
