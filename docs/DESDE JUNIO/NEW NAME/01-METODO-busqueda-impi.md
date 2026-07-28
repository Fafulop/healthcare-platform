# 01 — Método: cómo verificar registrabilidad ante el IMPI

Se puede hacer el 80% de esta verificación uno mismo, gratis, en ~10 minutos por nombre.

## 1. La herramienta: MARCANET

Base de datos oficial del IMPI. Es la misma que consulta el examinador. Gratuita.

- Portal: **https://acervomarcas.impi.gob.mx:8181/**
- Menú **Acervo Marcas** → **Búsqueda fonética avanzada**
- Liga directa al formulario:
  `acervomarcas.impi.gob.mx:8181/marcanet/vistas/common/datos/bsqFoneticaCompleta.pgi`

Cubre marcas **registradas** y **solicitudes en trámite**. Las que están en trámite también
bloquean si son anteriores a nuestra fecha de solicitud — es la parte que la gente olvida.

> Nota operativa: es un formulario con sesión y captcha, así que no se puede automatizar desde
> un agente. Se corre a mano y se pegan los resultados.

## 2. Cómo se corre

Por cada nombre, tres búsquedas — una por clase:

| Clase | Qué cubre | ¿La necesitamos? |
|---|---|---|
| **42** | Software, SaaS, plataformas, diseño y desarrollo | **Sí** — es donde vive el producto |
| **44** | Servicios médicos, telemedicina, veterinaria, belleza | **Sí** — si ofrecemos algo que cuente como servicio médico |
| 9 | Software *descargable*, aparatos, electrónica | No, mientras no haya binario descargable |
| 35 | Publicidad, administración de negocios | Solo si se reclama facturación / administración como servicio |

Y dentro de cada clase, tres variantes:

1. **Exacta:** `MICA`
2. **Truncada:** `MIC` — atrapa Micax, Micaela, Micaflor
3. **Primas fonéticas**, escritas como suenan: `MIKA`, `MYCA`, `MICCA`, `MIKKA`, `MICAH`

**El IMPI rechaza por sonido, no por ortografía.** *Zafira* y *Safira* son la misma marca para
el examinador. Hay que pensar con el oído, no con el ojo.

> ⚠️ La búsqueda **exacta no basta**. Ver el caso MICA en
> [03-ANALISIS-mica.md](03-ANALISIS-mica.md): la exacta salió limpia en clase 42 porque la
> anterioridad real está registrada como "MICA & CO", no como "MICA".

## 3. Cómo se leen los resultados

Mirar la columna **Estatus / Registro** de cada resultado:

| Situación | Qué significa |
|---|---|
| **Registrada** (tiene número de Registro) | Bloqueo vivo. Si está en nuestra clase y suena parecido, es un problema real. |
| **En trámite** (Expediente sin Registro) | También bloquea, si es anterior a nuestra solicitud. |
| **Caducada / Abandonada / Negada** | No bloquea. Buena señal — el campo está libre. |
| Registrada en clase **no relacionada** (p.ej. 25 ropa) | Normalmente irrelevante. Las marcas solo chocan entre clases relacionadas. |

Semáforo por nombre:

- 🟢 **Verde** — cero resultados en 42/44, o solo caducados. Se solicita.
- 🟡 **Ámbar** — existe una marca parecida pero en clase no relacionada, o la parecida está
  muerta, o el elemento dominante coincide pero los servicios concretos difieren. Amerita
  opinión de abogado.
- 🔴 **Rojo** — marca viva registrada en 42 o 44 que suena igual y cubre servicios parecidos.
  Siguiente nombre.

### El motor fonético es muy laxo

Una búsqueda fonética de "mika" en clase 42 devolvió **299 resultados**, incluyendo NIKE,
LA ÚNICA, KAMIKAZE, KONICA y MCNIFICA de McDonald's. **299 resultados ≠ 299 amenazas.** Hay
que triar a mano y quedarse con las que un examinador realmente citaría.

## 4. Lo que MARCANET no puede contestar

Una búsqueda limpia **no** significa registrable. El art. 173 de la LFPPI también niega:

- **Signos descriptivos o genéricos** de los servicios reclamados → esto es lo que mata
  *TuSalud*, y mataría *Galeno*, *Sanar*, *ClinicApp*.
- **Nombres de personas reales** sin consentimiento por escrito. (Nombres de pila comunes sin
  referente famoso sí se pueden.)
- **Elementos culturales de pueblos indígenas** sin consentimiento de la comunidad — reforma
  2020, se aplica activamente. Relevante para los candidatos nahuas / mayas.

La prueba mental: *¿mi nombre describe el servicio, o no tiene nada que ver con él?* Sin
relación gana. `Proa`, `Olmo`, `Brío`, `Mica` no tienen relación con software médico — eso es
una **marca arbitraria**, la más fuerte que existe fuera de una palabra inventada.

## 5. Criterio de confusión: no es solo la clase

La confusión se juzga sobre **similitud de la marca Y similitud de los servicios concretos
reclamados**, no sobre el número de clase.

La clase 42 es enorme: cubre software *y* arquitectura, diseño de interiores, investigación
industrial, diseño gráfico. Dos marcas parecidas pueden coexistir en 42 si una ampara
"servicios de diseño de interiores" y la otra "software como servicio para gestión de
consultorios médicos".

Por eso, ante una anterioridad, **el dato que decide es la descripción de productos y
servicios del expediente**, que se consulta en MARCANET por número de expediente.

## 6. Costos y plazos (2026)

| Concepto | Costo |
|---|---|
| Búsqueda propia en MARCANET | Gratis |
| *Estudio de viabilidad* con agente de propiedad industrial | ~$1,500 – $5,000 MXN |
| **Solicitud, por clase** | ~$2,850 – $3,126 MXN (según tarifa + IVA) |
| Descuento por presentar en **Marca en Línea** | −10% automático |
| Programa **"Marcas para el Bienestar"** (si se califica) | ~$313 MXN por clase |

- Plazo de resolución: **4 a 6 meses**.
- Presupuestar **dos clases** (42 + 44).
- La tarifa está en el art. 14 del Acuerdo de Tarifas del IMPI — verificar el vigente antes de
  pagar.

## 7. Qué hacer ante una objeción (impedimento)

Si el examinador cita una anterioridad, no es el final:

1. **Carta de consentimiento / convenio de coexistencia** con el titular de la marca anterior.
   El IMPI las acepta. Es la solución estándar y aburrida, y funciona — especialmente cuando el
   titular es una persona física en un giro distinto.
2. **Solicitar como MIXTA** (denominación + logo distintivo) en vez de nominativa. Sube las
   probabilidades de concesión; a cambio protege menos la palabra sola.
3. **Argumentar diferencia de servicios** con base en las descripciones de ambos expedientes.
4. Se tienen **2 meses** para responder al impedimento.

## Fuentes

- [MARCANET / Acervo Marcas IMPI](https://acervomarcas.impi.gob.mx:8181/)
- [Búsqueda fonética paso a paso](https://impi-gob.com.mx/impi-busqueda-fonetica/)
- [Costos IMPI 2026](https://www.simetrialegal.mx/negocio-sin-riesgo/registro-de-marca-impi-2026-guia-precios-requisitos)
- [Clasificación de Niza 2026](https://auramip.com/es/marcas/niza/)
