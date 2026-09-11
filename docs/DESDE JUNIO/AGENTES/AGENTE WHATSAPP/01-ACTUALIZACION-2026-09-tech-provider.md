# AGENTE WHATSAPP — actualización 2026-09: Tech Provider es autoservicio, coexistence ya es GA

> 🔒 **SNAPSHOT — 2026-09-10.** Re-verificación web de la exploración de julio
> ([`00-EXPLORACION-whatsapp-api.md`](00-EXPLORACION-whatsapp-api.md)), hecha porque **la cuenta
> de WhatsApp API está por aprobarse** y hay que decidir qué construir primero. Como todo lo de
> Meta: precios, límites y rollouts caducan — re-verificar contra la documentación vigente antes
> de construir. Índice: [`README.md`](README.md).

---

## 1. El miedo que se disipó: "hay que ser Tech Provider de Meta" NO es la barrera que parecía

La confusión era mezclar dos tiers distintos de Meta:

| Tier | Qué es | ¿Accesible? |
|---|---|---|
| **Solution Partner (BSP)** | El tier exclusivo (Twilio, 360dialog…): línea de crédito con Meta, revenden mensajería, lista cerrada | ❌ Difícil — y **no lo necesitamos** |
| **Tech Provider** | Camino de developer **autoservicio**: nuestra plataforma da acceso a la Cloud API a sus clientes (los doctores) | ✅ Es exactamente lo que somos |

**El proceso para ser Tech Provider** (fuentes: docs oficiales de Meta, verificado 2026-09-10):

1. Crear la app de Meta.
2. **Business Verification** de NUESTRA empresa: 2–5 días hábiles (hasta 14 si faltan
   documentos).
3. **App Review** para acceso avanzado a `whatsapp_business_messaging` +
   `whatsapp_business_management`: turnaround típico ~24h a unos días.
4. Con eso aprobado: **Embedded Signup** embebido en nuestra UI — cada doctor conecta su propio
   número/WABA sin salir de la app. Límite: **200 clientes nuevos por ventana rodante de 7
   días** (de sobra).

**Diferencia clave vs BSP:** los Tech Providers no tienen línea de crédito — **cada doctor (o
nosotros en su nombre) paga a Meta directo** por las conversaciones. Hay que decidir si el
doctor mete su método de pago o si lo re-facturamos.

## 2. Coexistence: ya no es "reciente y por verificar" — es GA desde mayo 2025

Lo que en julio era "alternativa nueva, verificar disponibilidad" ya está desplegado: un número
que corre la **app WhatsApp Business** puede conectarse TAMBIÉN a la Cloud API, **conservando el
historial de chats**, con mensajes espejeados en tiempo real en ambas direcciones.

Límites conocidos (2026-09):

- El doctor debe **abrir la app al menos una vez cada 13 días** o la cuenta se desactiva.
- Se pierden **listas de difusión** y mensajes temporales en la app.
- (En julio se anotaba: sin grupos/llamadas vía API — re-verificar el detalle vigente al
  construir.)

Esto importa muchísimo para nuestro caso: el doctor mexicano vive en su WhatsApp. Con
coexistence puede **seguir chateando normal desde su teléfono mientras el agente automatiza el
mismo número**.

## 3. Los dos escenarios — y por qué la decisión NO bloquea el arranque

| | **B/C · Un número genérico de la plataforma** (ya) | **A · Número propio del doctor** (Tech Provider) |
|---|---|---|
| Setup | Una WABA, solo nuestra Business Verification | + App Review + UI de Embedded Signup |
| El paciente ve | La marca de la plataforma | El nombre y número del doctor |
| Fricción del doctor | Cero | Cuenta Meta Business + popup de signup |
| Billing | Nosotros pagamos a Meta, va en la suscripción | El doctor paga a Meta directo (o re-facturamos) |

**El punto clave: el código de mensajería es IDÉNTICO en ambos casos.** Receptor de webhooks,
lógica de ventana de 24h, envío de plantillas, el turno del agente paciente-facing — todo es la
misma Cloud API sin importar de quién es el número. Solo cambia el *aprovisionamiento* (de quién
es el token y la WABA).

## 4. Secuencia recomendada (2026-09-10)

1. **Hoy, costo cero:** probar el loop completo con el **número de prueba** de Meta (5
   destinatarios verificados) contra dr-prueba — plantilla → respuesta → webhook → turno del
   agente → respuesta libre.
2. **v1:** un número genérico de la plataforma (escenario B/C). Plantillas de
   confirmación/recordatorio primero (sin LLM, valor inmediato, construye la plomería).
3. **En paralelo:** meter el papeleo de Tech Provider (Business Verification + App Review) —
   son esperas de días, no trabajo.
4. **v2:** Embedded Signup para que cada doctor conecte su número (escenario A), idealmente con
   coexistence para que conserve su app. **Nada de la v1 se tira.**

## 5. Lo que NO cambió de julio

Siguen vigentes tal cual: plantillas pre-aprobadas para mensajes iniciados por el negocio
(~centavos USD en México) · ventana de servicio de 24h renovada por cada respuesta del paciente
(ahí vive el agente) · opt-in obligatorio (LFPDPPP) · solo logística de la cita, nunca contenido
clínico · el diseño del agente paciente-facing de `00-EXPLORACION` §4 (scoping por
`patientId`/teléfono, reagendado = propuesta que confirma el doctor, tamaño "PR 5").

---

## Fuentes (2026-09-10)

- Meta for Developers: [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers) ·
  [App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review) ·
  [Embedded Signup](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- Coexistence: [360dialog docs](https://docs.360dialog.com/docs/resources/phone-numbers/coexistence) ·
  [YCloud (anuncio GA mayo 2025)](https://www.ycloud.com/blog/whatsapp-business-app-coexistence-meta-update)

*Investigación de origen: [`00-EXPLORACION-whatsapp-api.md`](00-EXPLORACION-whatsapp-api.md)
(2026-07-07, congelada). La visión de canales completa (WhatsApp + voz + recepcionista) se
conversó 2026-09-10; la parte de voz vive en
[`../AGENTE ELEVENLABS/`](../AGENTE%20ELEVENLABS/README.md).*
