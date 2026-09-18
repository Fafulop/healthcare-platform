# 05 — PLAN: una cuenta por doctor

> **Estado: PLAN, decidido en lo grande el 2026-09-18. Nada construido.**
>
> Nació de `04-PLAN-cambio-de-plan.md` §11: si a una cuenta que deja de pagar y cabe en GRATIS se
> la deja en GRATIS, y a la que no cabe se la congela, **el incentivo obvio es abrir otra cuenta
> gratis**. Y en general, repartir pacientes entre varias cuentas FREE es la forma de brincarse los
> topes (50 pacientes · 500 MB).

---

## 1. La regla

> **Una cuenta por doctor. Da igual si es gratis o de paga: una.**

Los **auxiliares** (usuarios secundarios de `NUEVOS USUARIOS`) no cuentan: son miembros de la
cuenta de un doctor, no cuentas de doctor.

## 2. La tensión

- **Abuso:** varias cuentas FREE de la misma persona, y **copycats** — la cédula es PÚBLICA
  (Registro Nacional de Profesionistas, SEP), cualquiera puede escribir la de otro.
- **Fricción:** pedir una identificación oficial al abrir una cuenta GRATIS es justo lo que hace
  que un doctor ni la abra.

Lo que está en juego en el abuso es chico (500 MB por cuenta), y quien reparte pacientes entre
cuentas vive incómodo — eso ya disuade. **La verificación tiene que ser proporcional**, no de banco.

## 3. ✅ Las tres capas (aprobadas por el usuario)

Sólo la última agrega fricción, y sólo a quien tiene motivo para aceptarla.

| Capa | Cuándo | Fricción | Qué frena |
|---|---|---|---|
| **Cédula única**, validada contra el registro de la SEP (existe y el nombre coincide) | Alta | Baja — el doctor se la sabe y ya se pide para la receta | Dos cuentas con la misma cédula |
| **Teléfono único**, verificado por SMS o WhatsApp | Alta | Muy baja en México | Copycats casuales: un número nuevo cuesta |
| **Identificación SÓLO en disputa** | Cuando alguien da de alta una cédula que ya está en uso | Sólo la ve el doctor real, que tiene motivo para darla | **El copycat** |

### El caso copycat

Si la cédula es única y alguien registra la de un doctor real, **el impostor bloquea al real**. La
salida es un flujo de disputa, no una identificación para todos:

1. El doctor real intenta darse de alta → «esa cédula ya está en uso».
2. Sube una identificación cuyo nombre coincide con el de la SEP.
3. Se le entrega la cédula; la cuenta impostora la pierde.

### Señales que ya vienen gratis

- **Cuentas de paga:** Stripe da una *fingerprint* por tarjeta. Dos cuentas pagando con la misma
  tarjeta = señal para el admin (no bloqueo automático).
- **Cuentas que facturan:** ya subieron su CSD, atado a su RFC. Es una prueba de identidad más
  fuerte que la foto de una credencial.

## 4. Lo que hay hoy (medido en el código, 2026-09-18)

- `Doctor.cedulaProfesional` **existe** (`schema.prisma:190`) pero es **opcional y NO única**.
- `Doctor.doctorCredentials` guarda `[{ titulo, cedula }]` para la receta (médico general +
  especialidades). La regla de unicidad debe decidir **cuál** cédula es la llave: la de la
  licenciatura (una por persona) es la candidata natural; las de especialidad no.
- No hay teléfono del DOCTOR verificado: `clinicPhone` es el del consultorio.

## 5. Antes de construir

1. **Rellenar y revisar las 12 cuentas actuales**: que todas tengan cédula y que no haya
   duplicados, ANTES de poner el índice único. La unicidad va como **SQL manual** + `prisma db
   execute`, nunca `prisma db push` (CLAUDE.md).
2. **Investigar la SEP**: ¿hay forma estable de consultar el registro automáticamente, o es
   *scraping* de su buscador público? No prometer la validación automática hasta saberlo. Si no
   hay forma estable, la capa 1 se queda en «cédula única» y la validación de nombre se hace a
   mano en el admin.
3. **Proveedor de verificación de teléfono** (SMS / WhatsApp). Se cruza con
   `AGENTES/AGENTE WHATSAPP/` (Tech Provider en trámite).
4. **Dónde vive la identificación en disputa**: es un dato personal sensible (LFPDPPP). Se guarda
   lo mínimo y se borra al resolver la disputa.
