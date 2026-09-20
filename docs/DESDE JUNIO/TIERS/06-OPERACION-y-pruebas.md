# 🩺 TIERS — operar el cobro y probarlo

> **Para qué.** Dos cosas que hasta ahora no estaban escritas en ningún lado:
>
> 1. **Cómo PROBAR el ciclo completo** (subir · dejar de pagar · margen · bajar ·
>    congelar · volver a pagar) sin esperar un mes, con el banco de pruebas de
>    `scripts/tiers-lifecycle/`.
> 2. **Cómo SABER, el día que se le cobre a doctores de verdad, si todo va bien** — qué mirar,
>    qué es normal, qué no lo es, y **qué NO se está mirando** hoy.

---

## 0. ¿Está esto listo para cobrarle a doctores de verdad?

**El mecanismo sí; la operación todavía no.** Conviene tenerlo separado:

| | |
|---|---|
| ✅ **Limpio, y verificado — no supuesto** | Un solo camino de escritura del tier (`setDoctorTier`) con su rastro completo · sólo un PAGO sube un plan · el cron le PREGUNTA a Stripe antes de bajar a nadie · congelar no borra nada y ni siquiera toca el tier · el checkout exige que quepas (R4) · el portal no deja cambiar de plan · el ciclo entero corrió de punta a punta el 2026-09-20 |
| 🔴 **Lo que falta no es el mecanismo: es poder VERLO** | Los avisos no salen a ningún lado (§3.1) · nadie reconcilia contra Stripe (C4) · al doctor nunca se le avisa nada (#6.4) |

Dicho corto: **alcanza para cobrar mirando**, no para cobrar y dejar de mirar. Con dos cuentas de
prueba y alguien pendiente, va bien. El día que haya diez doctores pagando y nadie mire la
pantalla durante una semana, el primer punto ciego de §3 se vuelve el problema.


---

## 1. El banco de pruebas

`scripts/tiers-lifecycle/` — scripts que corren **contra producción**, porque no hay otra
base de datos (ver `database-architecture.md`). Por eso lo primero que existe es cómo deshacer.

| Script | Qué hace |
|---|---|
| `estado.cjs foto` | Guarda a `foto.json` el estado exacto de las cuentas de prueba |
| `estado.cjs ver` | Lo imprime, sin tocar nada |
| `estado.cjs restaurar` | Lo devuelve a la foto, **se comprueba a sí mismo** campo por campo y borra la foto |
| `ciclo.cjs` | Corre los cuatro pasos del ciclo y comprueba cada uno |
| `pago.cjs` | Manda un `invoice.paid` **firmado** al webhook real |
| `portal.cjs` | Comprueba contra Stripe que el portal no deje cambiar de plan (§2.5) |

### Cómo se corre

```bash
# 1. SIEMPRE primero: la foto.
railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs foto

# 2. El ciclo. Necesita el secreto del cron, que vive en el servicio api.
CS=$(railway variables --service "@healthcare/api" --kv | grep -oP '^CRON_SECRET=\K.*')
CRON_SECRET="$CS" API_URL="https://healthcareapi-production-fb70.up.railway.app" \
  railway run --service pgvector node scripts/tiers-lifecycle/ciclo.cjs

# 3. El pago que descongela (el SUB_ID lo imprime el paso 4 del ciclo).
WS=$(railway variables --service "@healthcare/api" --kv | grep -oP '^STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=\K.*')
WEBHOOK_SECRET="$WS" API_URL="https://healthcareapi-production-fb70.up.railway.app" \
  SUB_ID="sub_…" node scripts/tiers-lifecycle/pago.cjs

# 4. SIEMPRE al final, pase lo que pase:
railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs restaurar
```

> ⚠️ **`railway run` inyecta el env de UN servicio.** La BD pública viene de `pgvector`; los
> secretos, de `@healthcare/api`. Por eso se leen con `railway variables` y se pasan como
> variables de entorno. Nunca imprimirlos.

### Qué toca, y nada más

- **dr-quebradita** — la cuenta del usuario, para ver el ciclo en pantalla. Su fila de
  `subscriptions` es REAL (modo prueba): se guarda entera y se repone.
- **fffffffff** — cuenta basura, para la rama de CONGELAR, que necesita pasarse del cupo de
  GRATIS. Se le siembran 51 pacientes marcados `PRUEBA-CICLO-TIERS`, y **sólo se borran los que
  llevan esa marca** (nunca un `deleteMany` amplio).

### Qué prueba — y qué NO

✅ **Lo que nunca se había ejecutado:** el cron bajando a alguien de verdad, el congelamiento
automático por no caber en Gratis, y que un pago sobre una cuenta CONGELADA la descongele y le
devuelva su plan.

❌ **Que Stripe EMITA lo que creemos, cuando lo creemos.** Para simular que alguien dejó de pagar
hay que **desligar `stripe_subscription_id`**, porque el cron le pregunta a Stripe antes de bajar
a nadie y —con razón— se negaría: allá la suscripción sigue viva. Esa rama, «Stripe dice que
está cancelada», es la única del camino que sigue sin probarse. La prueban los **relojes de
prueba (test clocks)** de Stripe, o el 17/18 de octubre solo.

❌ **Subir de plan.** No hace falta: es la única pata con evidencia real (el webhook ya escribió
3 veces en prod con cobros de verdad), y falsearla exigiría que Stripe reportara un precio que la
suscripción no tiene.

### Resultado de la corrida del 2026-09-20 (todo en verde)

| Paso | Qué devolvió |
|---|---|
| El cron no toca a quien está al corriente | dr-quebradita ni aparece |
| Vence el margen | `pasaría de BASICO a FREE` → y lo hizo |
| Rastro | `BASICO→FREE por cron:cobro-vencido` |
| No cabe en Gratis (51 pacientes) | `congelada (sigue en PRO, no cabe en Gratis)` |
| El tier NO se toca al congelar | sigue `PRO` — al pagar no hay nada que restaurar |
| Pago sobre cuenta congelada | webhook: `plan FREE -> BASICO`, descongelada, `pagado_hasta` renovado |

---

## 2. Cómo saber si el cobro va bien

### 2.1 Las tres preguntas, con su consulta

Todas de sólo lectura, con el método de `TOOLING-acceso-railway-db.md`.

**¿Quién está pagando, y hasta cuándo?**

```sql
SELECT d.slug, d.tier, s.status, s.pagado_hasta, s.cancel_at_period_end, s.last_payment_at
FROM public.doctors d
LEFT JOIN public.subscriptions s ON s.doctor_id = d.id
WHERE d.tier NOT IN ('FREE', 'LAB')
ORDER BY s.pagado_hasta;
```

**¿Quién movió un plan, y por qué?** `tier_change_log` es el ÚNICO rastro, y dice quién:

```sql
SELECT d.slug, l.from_tier, l.to_tier, l.origen, l.actor, l.motivo, l.created_at
FROM public.tier_change_log l JOIN public.doctors d ON d.id = l.doctor_id
ORDER BY l.created_at DESC LIMIT 20;
```

`origen` sólo puede ser: `webhook` (lo movió un pago — `actor` trae el `evt_…` de Stripe),
`admin` (una persona, con su correo), `script` (el cron u otro script, con su nombre).

**¿Hay alguien congelado?**

```sql
SELECT slug, tier, congelada_desde FROM public.doctors WHERE congelada_desde IS NOT NULL;
```

### 2.2 Qué es normal y qué no

| Señal | Normal | 🔴 Alarma |
|---|---|---|
| `subscriptions.status` | `active` | `past_due` más de ~7 días · `canceled` con el doctor todavía en plan de pago |
| `pagado_hasta` | en el futuro | vencido **y** el doctor sigue en BÁSICO/PRO más de 15 días ⇒ el cron no está corriendo |
| `tier_change_log` | filas con `origen='webhook'` cada vez que alguien paga | **ninguna fila nueva tras un cobro** ⇒ el webhook no está escribiendo |
| Cuentas congeladas | 0, o las que dejaron de pagar | una congelada que YA pagó ⇒ el `invoice.paid` no llegó |
| `doctors.tier` vs Stripe | coinciden | divergen ⇒ es justo lo que C4 vendría a reportar, y **C4 no está construido** |

### 2.3 Los logs

En Railway → `@healthcare/api` → Deploy Logs. Prefijos:

- **`[COBRO]`** — todo lo del cobro: checkout, portal, cambiar-plan, el webhook y el cron.
  `[COBRO] cron cobro-vencido` sale una vez al día; `[COBRO] firma de webhook inválida` significa
  que algo llamó al endpoint sin ser Stripe (o con el secreto del otro modo).
- **`[CAMBIO-PLAN]`** — las solicitudes de bajar de plan (#7a).
- **`[EXPORTAR]`** — las descargas de «Mi información» (#6.3).

El **cron** corre cada 15 min desde el servicio `cron` de Railway y se auto-limita a UNA pasada
diaria (09:00–09:14 MX). Responde `{skipped: 'fuera de la ventana diaria'}` el resto del día: eso
es lo normal, no un error. Con `?dryRun=1` dice lo que HARÍA sin escribir; con `?forzar=1` salta
la ventana (para probar).

### 2.4 La pantalla que ya existe

**Admin → Cobro** enseña el precio de cada plan resuelto **desde Stripe** (el monto no se guarda
en nuestra BD a propósito), el estado de cobro de cada doctor, la bandeja de solicitudes de bajar
de plan, y una lista de **`faltantes`**: las variables de entorno que hacen falta. Esa lista es lo
primero que hay que mirar cuando «algo no cobra».

---

---

## 2.5 El portal de Stripe — verificado el 2026-09-20

El portal de clientes es por donde el doctor **cancela** y actualiza su tarjeta. Dos ajustes suyos
cambian el comportamiento de todo lo demás, así que se comprobaron contra la API de Stripe (no
contra el dashboard, ni de memoria) con `scripts/tiers-lifecycle/portal.cjs`:

```
configuración bpc_1UGmFIAh75vmZoEti7H1YE0i  (POR DEFECTO ← la que se usa)
  activa: true
  CAMBIAR DE PLAN (subscription_update): ✅ apagado
  CANCELAR (subscription_cancel): ✅ encendido
     modo: at_period_end · prorrateo: none
```

- **Cambiar de plan APAGADO** es lo que impide que un doctor se cambie de tier dentro del portal
  y nuestra BD nunca se entere: Stripe le cambiaría el precio y aquí seguiría diciendo el plan
  viejo. Es la razón de ser de la advertencia de `billing/portal/route.ts`.
- **Cancelar `at_period_end`** es lo que hace coherente el margen: cancelar el día 3 de un mes ya
  pagado **no corta el servicio**, sólo impide la renovación del día 30. El margen de 15 días
  empieza cuando se acaba lo pagado, **no cuando se cancela**. Con `proration_behavior: none` no
  hay devolución parcial: se queda con lo que pagó hasta el último día.

### 🔴 La configuración del portal es POR MODO

Lo de arriba es de **modo PRUEBA** (`sk_test`). Stripe guarda la configuración del portal por
modo, así que **NADA de esto existe en modo VIVO hasta que se configure otra vez**. Si se pasa a
vivo sin repetirlo, el portal sale con los valores por defecto de Stripe y **un doctor de verdad
podrá cambiarse de plan ahí**, con nuestra BD creyendo que sigue en el viejo.

Comprobarlo el día del cambio, con la clave viva:

```bash
railway run --service "@healthcare/api" node scripts/tiers-lifecycle/portal.cjs
```

Debe decir `modo: VIVO`, `CAMBIAR DE PLAN: ✅ apagado` y `CANCELAR: at_period_end`.

## 3. 🕳️ Los puntos ciegos de HOY (2026-09-20)

Lo importante de esta sección es que **no son sospechas, son ausencias conocidas**:

1. **🔴 Los avisos no salen a ningún lado.** `TELEGRAM_ADMIN_CHAT_ID` **no está puesta** en
   `@healthcare/api`. `avisarAdmin()` lo comprueba, escribe un `console.warn` y se va sin mandar
   nada. O sea: pago fallido, cancelación, precio fuera del mapa, «no se pudo pasar a Gratis» y
   «se congeló a alguien» **sólo existen en los logs**, y nadie mira los logs a las 9 de la
   mañana. **Es UNA variable de entorno, y es lo más barato que se puede arreglar de esta lista.**
2. **No hay reconciliación (C4).** Nadie compara Stripe contra `doctors.tier`. Si el webhook
   dejara de escribir, desde dentro de la app «nadie pagó» y «el webhook está roto» se ven
   IGUAL. C4 existe justo para eso y no está construido.
3. **El doctor no recibe ningún correo (#6.4).** Ni «tu plan baja el 17», ni «tu plan bajó», ni
   «tu cuenta se congeló». Se entera porque las cosas dejan de estar en su pantalla. Además **no
   hay NINGUNA infraestructura de correo en el repo**: lo único que manda correo es `lib/gmail.ts`,
   y manda COMO el doctor, con sus propios tokens de Google.
4. **La descarga masiva de expedientes no deja rastro (#6.5).**

### Lo que va a pasar solo, sin que nadie lo empuje

**dr-prueba renueva el 17 de octubre y dr-quebradita el 18.** Esa será la primera vez que el
camino de renovación corra de verdad, sin nadie mirando. Qué revisar esos días:

- que aparezca una fila nueva en `tier_change_log` con `origen='webhook'`;
- que `pagado_hasta` se haya movido un mes;
- y si NO pasa: mirar los `[COBRO]` del api antes de tocar nada, porque a los 15 días el cron
  empieza a bajar planes.

Los **relojes de prueba de Stripe** permiten ver ese desenlace HOY en vez de esperar: un cliente
en un reloj simulado que se adelanta 30 días en segundos.
