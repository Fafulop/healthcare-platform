# 🔄 Refresco de sesión — CONSULTORIOS — LÉEME PRIMERO

> Tipo **ESTADO / BITÁCORA**. Se lee al empezar y se escribe al terminar.

> # 🤝 HANDOFF 2026-08-06 (fin de sesión)
>
> ## En una frase
> **La feature está COMPLETA y en producción**: una cita ya sabe en cuál consultorio es, la
> registra desde los dos endpoints, el modal la pregunta sólo cuando hace falta y el agente
> también. **Lo que queda no es construir, es MIRAR**: nadie ha visto la negativa del agente en
> una conversación real, y las 269 citas viejas se quedaron sin consultorio a propósito.

## 1. Lo que se desplegó hoy (5 commits, todo en prod)

| commit | qué | ¿probado a mano? |
|---|---|---|
| `e2d10151` | Columna `bookings.location_id` + FK `ON DELETE SET NULL` + índice, corridos a mano contra prod | n/a (DDL verificado) |
| `75fdcbd2` | Los DOS endpoints de rangos la escriben. Regla en `apps/api/src/lib/booking-location.ts` | ✅ **clic real**: cita dentro de un rango → heredó Consultorio Polanco |
| `b32fde2f` | **Borrar un rango con citas dentro YA SE PUEDE** (pedido del usuario). Las citas quedan intactas | ❌ |
| `06aad405` | El **modal** pregunta el consultorio — sólo si el doctor tiene 2+ **y** la hora cae fuera de todo rango | ❌ |
| `ea2b62f7` | El **agente** igual, con veredicto server-side. Y ya puede LEER el consultorio de las citas | ❌ (sí: 2 corridas de evals) |

Diseño y detalle completo: [`02-PLAN-columna-y-los-tres-saltos.md`](02-PLAN-columna-y-los-tres-saltos.md)
§4.1 (endpoints) · §4.2 (modal) · §4.3 (agente + las dos corridas de evals).

## 2. 🧪 LO PRIMERO de la próxima sesión: mirar lo que nadie ha visto

Tres cosas están vivas en prod sin que un humano las haya ejercido:

1. **La negativa del agente.** Con `dr-prueba` (tiene Polanco + Satélite), pídele al asistente
   algo como *"agéndame a Juan Pérez mañana a las 16:07"* (una hora fuera de todo rango). Debe
   **preguntar en cuál consultorio** con las dos opciones, y al contestarle, proponer la cita.
   En evals sale bien las dos veces; en una conversación real, nadie lo ha visto.
2. **El selector del modal.** Misma idea desde `/dashboard/appointments`: una hora DENTRO de un
   rango debe enseñar la línea gris *"se toma del rango"*; una hora FUERA debe enseñar el
   selector debajo de Modalidad, con el consultorio de arriba de Editar Perfil preseleccionado.
3. **Borrar un rango con citas dentro.** Debe preguntar *"este rango tiene N cita(s) agendadas
   dentro…"* y, al aceptar, borrar el rango y **dejar las citas intactas**.

Para comprobar qué quedó guardado, read-only contra prod (método en
[`../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)):

```sql
SELECT b.id, b.date, b.start_time, b.patient_name, cl.name AS consultorio
FROM public.bookings b
LEFT JOIN public.clinic_locations cl ON cl.id = b.location_id
ORDER BY b.created_at DESC LIMIT 5;
```

## 3. Las decisiones que NO se re-litigan

- 🔑 **`NULL` = NO REGISTRADO, nunca "el de por defecto"** — al revés que las columnas del mismo
  nombre en `appointment_slots` y `availability_ranges`. Medido: de 412 citas, exactamente **DOS**
  cambiarían de hospital bajo la otra lectura (las de `dra-adriana-michelle` en CHRISTUS Muguerza,
  que no es su default). Dos citas justifican invertir la convención: un `NULL` que se ve `NULL`
  se arregla; uno que se rinde como "Hospital Ángeles" manda al paciente al otro lado de Monterrey.
- **Dentro de un rango NO se pregunta** (se hereda y se ENSEÑA); fuera de todo rango **sí**, y
  sólo si el doctor tiene 2+. Con un solo consultorio nunca se pregunta pero **sí se registra**.
- **El backfill de las 269 citas viejas NO se hace** (decisión del usuario, 2026-08-06). Se
  quedan en `NULL` para siempre. ⚠️ Y ahora se puede perder más rápido: borrar un rango —que ya
  no está bloqueado— destruye el único lugar donde sobrevivía el dato de esas citas.
- **Los endpoints de SLOTS quedaron fuera** a propósito: mecanismo obsoleto, la UI viva no los
  alcanza (`/dashboard/appointments` pasa `rangeMode` sin condición).

## 4. Pendientes REALES (por orden de valor)

1. **Mostrar el consultorio en la tabla de citas y en el modal de detalle.** Hoy el dato es
   correcto e **invisible** en la UI: se guarda, el agente lo lee, pero la pantalla de Citas no lo
   enseña. Es la mitad del problema original y es lo más barato que queda.
2. **Filtro por consultorio.** El agente puede leer y separar, pero `get_bookings` no filtra
   server-side. `02-CAPACIDADES` §2 ya lo dice así.
3. **Tres huecos de PERTENENCIA en el camino de slots** (encontrados por code review, NO
   arreglados): `bookings/instant:104`, `slots/route.ts:303`, `slots/[id]/route.ts:96` aceptan el
   `locationId` del cliente **sin validar que sea de ese doctor**. Rutas muertas en la UI,
   endpoints vivos. `ranges/route.ts:206` ya lo hace bien.
4. **Cerrar la diferencia de la cascada de `blockedTime`** entre el borrado individual y el
   masivo (documentada en `ranges/[id]/route.ts`), si se decide que debe cerrarse.

## 5. Lo que costó caro esta sesión (para no repetirlo)

- 🎯 **El modo `freeform=1` descartaba los rangos reales**, así que toda hora ESCRITA salía sin
  consultorio aunque cayera dentro de un rango. El servidor heredaba bien al crear, pero el
  picker no podía distinguir *"no hay consultorio"* de *"hay uno y no te lo dije"*. Sin ver eso,
  el paso 3 se habría construido preguntando siempre.
- 🎯 **Las evals PASARON mientras el agente afirmaba algo falso** (*"las citas no registran dónde
  se llevaron a cabo"*). El regex se conformaba con la explicación equivocada. La causa era real:
  se ESCRIBÍA el consultorio y no se LEÍA. **Un caso verde no garantiza una afirmación cierta.**
- **Una corrida de evals no distingue regresión de ruido**: la corrida 1 dio 2 WARN y la 2 dio 3;
  el único ESTABLE en las dos era el de verdad. Siempre dos, y se intersectan.
- **`08-EMPIEZA-AQUI.md` declaraba 65 evals y 39 tools** (reales: 87 y 38) — el doc que
  `CLAUDE.md` manda leer primero, con el error que ese mismo doc existe para prevenir. Corregido.
  Sólo el marcador de `02-CAPACIDADES` está cubierto por `gate:docs`; las copias no.
