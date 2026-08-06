// ¿En cuál consultorio es esta cita?
//
// La REGLA vive aquí, y no dentro de cada endpoint, porque son DOS los que crean citas por
// rangos (`range-bookings` y `range-bookings/instant`) y tiene que ser la misma en los dos:
// lógica replicada = deriva garantizada, y aquí la deriva sería mandar a un paciente a la
// dirección equivocada.
//
// La regla, en tres líneas:
//   1. Si el que agenda dice explícitamente en cuál consultorio es, gana eso — siempre que el
//      consultorio sea de ESE doctor.
//   2. Si no lo dice, se HEREDA del rango que contiene la cita. El rango ya sabe su consultorio
//      y hasta hoy ese dato se cargaba a memoria y se tiraba.
//   3. Si no hay ni lo uno ni lo otro, queda NULL = **no registrado**.
//
// ⚠️ NULL no significa "el consultorio por defecto", a diferencia de las columnas del mismo
// nombre en `appointment_slots` y `availability_ranges`. Resolverlo al default haría que las
// citas de un doctor con DOS sedes reales afirmaran la dirección equivocada. Medido en prod
// (2026-08-06): de 412 citas, exactamente DOS cambiarían de hospital bajo esa lectura — las dos
// de `dra-adriana-michelle` que caen en CHRISTUS Muguerza y no en su default. Dos citas es poco
// y es justo el daño que esta feature existe para evitar.
//
// ⚠️ Qué comparte cada endpoint, con precisión — la versión anterior de este comentario decía
// que los dos usaban este archivo, y no es verdad:
//   · `range-bookings/instant` usa las DOS funciones (acepta `locationId` del cliente).
//   · `range-bookings` NO importa nada de aquí: no acepta `locationId`, y para heredar reutiliza
//     el `matchingRange` que YA consultó para el check de `NO_RANGE` — pedir el mismo rango otra
//     vez sólo para leerle una columna sería una query de más en el camino público.
// Las dos rutas coinciden en el resultado porque el API prohíbe que dos rangos se solapen: a lo
// sumo UN rango contiene la ventana, así que "el rango contenedor con consultorio" y "el rango
// contenedor" son el mismo. Si algún día se permiten rangos solapados, esa equivalencia se
// rompe y `range-bookings` tiene que pasar a llamar a `inheritLocationFromRange`.

import type { Prisma } from '@healthcare/database';

/** `PrismaClient` es asignable a esto, así que sirve dentro y fuera de una transacción. */
type Db = Prisma.TransactionClient;

export type ValidateLocationResult =
  /** `null` = el cliente no pidió ninguno ⇒ toca heredar. */
  | { ok: true; locationId: string | null }
  /** El consultorio pedido no es de este doctor (o no es un id). El endpoint contesta 400. */
  | { ok: false; error: string };

/**
 * Paso 1 de la regla: valida el consultorio EXPLÍCITO que mandó el cliente.
 *
 * Va **fuera** de la transacción, junto a las validaciones de `serviceId` y `patientId`: es una
 * lectura que no necesita ni el lock del día ni la transacción, y hacerla dentro significaba que
 * una petición condenada a 400 primero tomaba el advisory lock de doctor+fecha y corría los
 * checks de traslape — gastando presupuesto de transacción interactiva en una ruta que ya
 * trata el timeout `P2028` como modo de fallo conocido.
 */
export async function validateRequestedLocation(
  db: Db,
  { doctorId, requestedLocationId }: { doctorId: string; requestedLocationId?: unknown }
): Promise<ValidateLocationResult> {
  // Nada pedido (o cadena vacía, que es como los formularios mandan "ninguno") ⇒ a heredar.
  if (requestedLocationId === undefined || requestedLocationId === null) {
    return { ok: true, locationId: null };
  }

  // ⚠️ Un valor presente pero que NO es un id se rechaza; NO se cae a la herencia. Si un cliente
  // manda `42` o `{id:…}` y lo tratáramos como "no dijo nada", la cita se guardaría en un
  // consultorio DISTINTO al que pidió y contestaríamos 201: la petición fue atendida mal y nadie
  // se entera. Para un campo cuyo propósito es no rendir una suposición como un hecho, un
  // explícito malformado tiene que fallar ruidosamente.
  if (typeof requestedLocationId !== 'string') {
    return { ok: false, error: 'El consultorio seleccionado no es válido' };
  }

  const locationId = requestedLocationId.trim();
  if (!locationId) {
    return { ok: true, locationId: null };
  }

  // Se valida la PERTENENCIA, igual que `serviceId`: sin esto, cualquiera con sesión podría
  // colgarle a su cita el consultorio de otro doctor, y la FK lo aceptaría tan campante — apunta
  // a `clinic_locations`, no a "los consultorios de este doctor".
  const owned = await db.clinicLocation.findFirst({
    where: { id: locationId, doctorId },
    select: { id: true },
  });
  if (!owned) {
    return { ok: false, error: 'El consultorio seleccionado no es válido' };
  }
  return { ok: true, locationId: owned.id };
}

/**
 * Paso 2 de la regla: hereda del rango que CONTIENE la cita.
 *
 * Va **dentro** de la transacción, al revés que la validación: lee el mismo estado que los checks
 * de traslape de arriba, así que si alguien borra el rango a medio camino no se hereda de un
 * rango fantasma.
 *
 * ⚠️ Sólo hereda de un rango que tenga consultorio: uno sin él no aporta información, y
 * `location_id: null` en el rango también significa "no dicho". (Medido 2026-08-06: hoy los 856
 * rangos de prod tienen consultorio, así que este filtro no se dispara — está puesto porque la
 * columna es nullable.)
 */
export async function inheritLocationFromRange(
  tx: Db,
  {
    doctorId,
    date,
    startTime,
    endTime,
  }: {
    doctorId: string;
    /** Fecha normalizada a medianoche UTC, como la guarda `bookings.date`. */
    date: Date;
    /** "HH:MM" */
    startTime: string;
    /** "HH:MM" */
    endTime: string;
  }
): Promise<string | null> {
  // Mismo predicado de contención que usa `range-bookings` para decidir si la cita cae dentro de
  // un rango publicado.
  const containing = await tx.availabilityRange.findFirst({
    where: {
      doctorId,
      date,
      startTime: { lte: startTime },
      endTime: { gte: endTime },
      locationId: { not: null },
    },
    select: { locationId: true },
  });

  // Sin rango contenedor (cita freeform fuera de todo rango) → no registrado.
  return containing?.locationId ?? null;
}
