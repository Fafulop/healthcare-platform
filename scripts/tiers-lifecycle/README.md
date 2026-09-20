# Banco de pruebas del ciclo de vida del cobro (TIERS)

> 📖 **La guía completa —cuándo usarlo, qué prueba, qué NO, y cómo vigilar el cobro en
> producción— está en
> [`docs/DESDE JUNIO/TIERS/06-OPERACION-y-pruebas.md`](../../docs/DESDE%20JUNIO/TIERS/06-OPERACION-y-pruebas.md).**
> Aquí sólo está lo mínimo para no equivocarse al correrlo.

## ⚠️ Esto corre contra PRODUCCIÓN

No hay base de datos local (`database-architecture.md`, aviso del 2026-09-20). Todo lo que hacen
estos scripts le pasa a la base de verdad. Por eso:

1. **`foto` SIEMPRE antes de nada.** Sin `foto.json` no hay a dónde volver, y `restaurar` se
   niega a correr sin ella.
2. **`restaurar` SIEMPRE al final**, aunque el ciclo haya fallado a la mitad. Se comprueba a sí
   mismo campo por campo y sólo borra la foto si quedó idéntico.
3. Sólo se tocan **dr-quebradita** y **fffffffff**. Ninguna otra cuenta.

```bash
railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs foto
# … correr ciclo.cjs y pago.cjs (ver la guía) …
railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs restaurar
```

## Los archivos

| | |
|---|---|
| `estado.cjs` | `foto` · `ver` · `restaurar`. La red de seguridad. |
| `ciclo.cjs` | Los 4 pasos del ciclo, cada uno con su comprobación. |
| `pago.cjs` | Un `invoice.paid` FIRMADO al webhook real (descongela y restaura el plan). |
| `portal.cjs` | Comprueba contra Stripe que el portal NO deje cambiar de plan. **Repetir en modo VIVO: la configuración del portal es por modo.** |
| `foto.json` | El estado guardado. **No se commitea** — es de una corrida concreta. |

## Lo que hay que saber antes de tocarlo

- **`railway run` inyecta el env de UN servicio.** La URL pública de la BD viene de `pgvector`;
  `CRON_SECRET` y `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`, del servicio `@healthcare/api`. Por eso
  se leen con `railway variables` y se pasan como variables de entorno — nunca se imprimen.
- **Para simular «dejó de pagar» hay que desligar `stripe_subscription_id`.** No es un truco
  sucio: el cron le PREGUNTA a Stripe antes de bajar a nadie, y allá la suscripción sigue viva.
  Sin desligarla, el cron responde «Stripe dice que está al corriente; no se toca» — que es
  exactamente lo que debe hacer. El precio de esto es que esa rama queda sin probar.
- **Los pacientes sembrados llevan `generalNotes = 'PRUEBA-CICLO-TIERS'`** y el borrado filtra
  por esa marca. Nunca ampliar ese `deleteMany`.
