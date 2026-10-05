# GUÍAS — una por flujo, para el doctor

> 📍 **Desde 2026-10-05 los archivos viven en el código:** `apps/doctor/src/lib/ayuda/guias/` (H3 — la
> pestaña «Flujos» de Ayuda los pinta tal cual; un archivo nuevo ahí = una guía nueva en la página). Esta
> carpeta conserva sólo este índice. La línea «QA (interno…)» de cada guía sigue en su archivo y la página
> la quita en el servidor; `apps/doctor/scripts/ayuda-guias-check.ts` falla si se colara, y revisa que
> cada «etiqueta» exista en el código.

> **Tipo: GUÍAS (texto para doctores, en español).** Cada archivo sale de una corrida ✅ del catálogo
> (`../01-CATALOGO-flujos.md`), nunca de memoria, y lo revisa el usuario antes de publicarse. Se montan
> en la página «Flujos» de Ayuda (fase H3, `../../AYUDA WIDGET/`) y son la base del guion de cada video
> (H4).

Nombre del archivo: `<id>-<verbo-corto>.md` (p. ej. `A6-completar-una-cita.md`).

Plantilla (ver `../00-PLAN.md` §6):

```markdown
# <Título en lenguaje del doctor: «Cobrar una consulta al terminarla»>

**Para qué:** una línea.

**Antes de empezar:** lo que debe estar configurado (con enlace a su guía).

**Pasos**
1. <un clic por paso, con la etiqueta exacta entre «»>

**Qué vas a ver:** …

**Tu dinero:** qué entra a Flujo de Dinero, cuándo y con qué datos.

**Si algo sale mal:** el error que puede salir y qué hacer.

**Video:** (pendiente)
```

> **2026-10-05:** el usuario las da por buenas **provisionalmente** para avanzar con H3 (las leerá después). Revisadas contra el código ese día: etiquetas (213/235 encontradas; el resto son ejemplos con valores o texto armado en tiempo de ejecución) y contenido tras los arreglos del día (E4b, E5, E11 actualizadas; A17 dice dónde están las tarjetas; E4a «Agregar Opción»).

| Guía | Flujo | Estado |
|---|---|---|
| [A1-A2-agendar-una-cita](../../../../apps/doctor/src/lib/ayuda/guias/A1-A2-agendar-una-cita.md) | A1 | borrador — listo para revisar |
| [A10-reagendar-una-cita](../../../../apps/doctor/src/lib/ayuda/guias/A10-reagendar-una-cita.md) | A10 | borrador — actualizada 2026-10-04 (H-054) |
| [A11-bloquear-horarios](../../../../apps/doctor/src/lib/ayuda/guias/A11-bloquear-horarios.md) | A11 | borrador — listo para revisar |
| [A12-publicar-tu-horario](../../../../apps/doctor/src/lib/ayuda/guias/A12-publicar-tu-horario.md) | A12 | borrador — listo para revisar |
| [A13-ligar-la-cita-al-expediente](../../../../apps/doctor/src/lib/ayuda/guias/A13-ligar-la-cita-al-expediente.md) | A13 | borrador — listo para revisar |
| [A14-formulario-pre-consulta](../../../../apps/doctor/src/lib/ayuda/guias/A14-formulario-pre-consulta.md) | A14 | borrador — listo para revisar |
| [A15-nota-de-la-cita](../../../../apps/doctor/src/lib/ayuda/guias/A15-nota-de-la-cita.md) | A15 | borrador — listo para revisar |
| [A16-pedir-datos-fiscales](../../../../apps/doctor/src/lib/ayuda/guias/A16-pedir-datos-fiscales.md) | A16 | borrador — listo para revisar |
| [A17-recordatorios-y-campos-de-cita](../../../../apps/doctor/src/lib/ayuda/guias/A17-recordatorios-y-campos-de-cita.md) | A17 | borrador — listo para revisar |
| [A3-agendar-desde-el-calendario](../../../../apps/doctor/src/lib/ayuda/guias/A3-agendar-desde-el-calendario.md) | A3 | borrador — listo para revisar |
| [A4-confirmar-una-cita-del-perfil-publico](../../../../apps/doctor/src/lib/ayuda/guias/A4-confirmar-una-cita-del-perfil-publico.md) | A4 | borrador — actualizada 2026-10-04 (H-038) |
| [A5-confirmacion-y-bloqueo-extendido](../../../../apps/doctor/src/lib/ayuda/guias/A5-confirmacion-y-bloqueo-extendido.md) | A5 | borrador — listo para revisar |
| [A6-A7-completar-una-cita](../../../../apps/doctor/src/lib/ayuda/guias/A6-A7-completar-una-cita.md) | A6 | borrador — actualizada 2026-10-04 (cortesía $0, link se apaga) |
| [A8-cobrar-con-link-de-pago](../../../../apps/doctor/src/lib/ayuda/guias/A8-cobrar-con-link-de-pago.md) | A8 | borrador — actualizada 2026-10-04 (H-010: link se apaga; pago real sin probar) |
| [A9-cancelar-no-asistio-eliminar](../../../../apps/doctor/src/lib/ayuda/guias/A9-cancelar-no-asistio-eliminar.md) | A9 | borrador — listo para revisar |
| [E1-crear-un-paciente](../../../../apps/doctor/src/lib/ayuda/guias/E1-crear-un-paciente.md) | E1 | borrador — listo para revisar |
| [E11-archivar-un-paciente](../../../../apps/doctor/src/lib/ayuda/guias/E11-archivar-un-paciente.md) | E11 | borrador — listo para revisar |
| [E3-abrir-una-visita](../../../../apps/doctor/src/lib/ayuda/guias/E3-abrir-una-visita.md) | E3 | borrador — listo para revisar |
| [E4a-crear-tu-propia-plantilla](../../../../apps/doctor/src/lib/ayuda/guias/E4a-crear-tu-propia-plantilla.md) | E4a | borrador — actualizada 2026-10-04 (H-018 en español; re-verificar tras H-025) |
| [E4b-llenar-una-plantilla](../../../../apps/doctor/src/lib/ayuda/guias/E4b-llenar-una-plantilla.md) | E4b | borrador — re-verificar tras el arreglo de H-025 |
| [E5-hacer-una-receta](../../../../apps/doctor/src/lib/ayuda/guias/E5-hacer-una-receta.md) | E5 | borrador — listo para revisar (H-027 arreglado) |
| [E6-subir-foto-o-documento](../../../../apps/doctor/src/lib/ayuda/guias/E6-subir-foto-o-documento.md) | E6 | borrador — listo para revisar |
| [E7-notas-y-comentario-de-la-visita](../../../../apps/doctor/src/lib/ayuda/guias/E7-notas-y-comentario-de-la-visita.md) | E7 | borrador — listo para revisar |
| [E9-venta-en-la-visita](../../../../apps/doctor/src/lib/ayuda/guias/E9-venta-en-la-visita.md) | E9 | borrador — listo para revisar |
| [T1-crear-un-tratamiento](../../../../apps/doctor/src/lib/ayuda/guias/T1-crear-un-tratamiento.md) | T1 | borrador — listo para revisar |
| [T6-cobrar-una-sesion-y-la-cuenta](../../../../apps/doctor/src/lib/ayuda/guias/T6-cobrar-una-sesion-y-la-cuenta.md) | T6 | borrador — listo para revisar |
| [T7-cancelar-reactivar-o-ligar-una-sesion](../../../../apps/doctor/src/lib/ayuda/guias/T7-cancelar-reactivar-o-ligar-una-sesion.md) | T7 | borrador — listo para revisar |
