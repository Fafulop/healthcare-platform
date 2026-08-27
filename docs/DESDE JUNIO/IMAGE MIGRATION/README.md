# IMAGE MIGRATION — salir de UploadThing hacia Cloudflare R2

> **Qué es esta carpeta.** Todo lo de mover el almacenamiento de archivos (imágenes clínicas,
> PDFs fiscales, marketing) de **UploadThing** a **Cloudflare R2**: el análisis que llevó a
> esa decisión y el plan para ejecutarla.
>
> **Estado (2026-08-27): DECIDIDO, NO EMPEZADO.** Hay análisis y plan; no hay una sola línea
> de código.

## Archivos

| Archivo | Qué es |
|---|---|
| [`01-ANALISIS-uploadthing-vs-alternativas.md`](01-ANALISIS-uploadthing-vs-alternativas.md) | Cuánto guardamos (medido en prod), qué cuesta, R2 vs B2 vs UploadThing, si las empresas son serias, y la parte legal |
| [`02-PLAN-migracion-a-r2.md`](02-PLAN-migracion-a-r2.md) | Las 3 fases, las decisiones de diseño, cómo se verifica y los riesgos. Trae **bitácora** al final |

## Lo que hay que saber aunque no leas nada más

1. **Guardamos ~0.2 GB en 232 archivos** y pagamos **$10/mes**. En R2 eso cuesta **$0** (10 GB
   gratis). El ahorro no es el punto: son $120 al año.
2. **El punto es migrar barato.** El costo de migrar escala con los datos: 232 archivos hoy,
   otro proyecto a 100 GB.
3. **No hay día de corte.** La BD guarda **URLs absolutas**, así que los archivos viejos siguen
   sirviéndose desde UploadThing mientras los nuevos van a R2. Las dos épocas conviven solas.
4. **Se eligió R2 por facilidad y herramientas, no por precio** — a nuestro tamaño R2 y B2
   cuestan lo mismo ($0). B2 es más barato por GB y sigue siendo la alternativa si algún día
   atendemos pacientes de EE.UU. (ahí sí importa el BAA, que Cloudflare sólo da en Enterprise).
5. 🔴 **Hoy las imágenes clínicas están en URLs públicas permanentes.** Inadivinables, pero sin
   autenticación y para siempre. La migración es la oportunidad de separarlas en un bucket
   privado con enlaces de vida corta — y es más barato hacerlo ahora que volver a migrar.

## Lo que falta para empezar

- Cuenta de Cloudflare con **R2 habilitado**, bucket(s) y **token S3** (Access Key + Secret)
  cargados en Railway.
- Confirmar la separación **privado (clínico) / público (marketing)** del plan §3.2.

## Tipo de documento

- El `01` es **SNAPSHOT en precios y volumen** (esos números envejecen; re-verifícalos contra
  las fuentes del §6 antes de decidir otra cosa) y **REFERENCIA en la decisión**.
- El `02` es un **PLAN vivo**: se actualiza su §7 (bitácora) al cerrar cada fase, y se le pone
  banner `🔒 SNAPSHOT` cuando la migración termine.

---

*⬆️ Convenciones de estos docs: [`../AGENTES/GENERAL AGENTES/07-CONVENCIONES-docs.md`](../AGENTES/GENERAL%20AGENTES/07-CONVENCIONES-docs.md).*
