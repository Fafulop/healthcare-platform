# 09 — CATÁLOGO: las aseguradoras que faltan, MEDIDAS

> Tipo **HALLAZGO / ESTADO**. Medido el **2026-08-21** bajando los PDFs del dominio de cada
> aseguradora y corriendo `alta-formato inspeccionar` sobre cada uno.
> El procedimiento para dar de alta cualquiera de éstas es
> [`08-ALTA-de-un-formato-nuevo.md`](08-ALTA-de-un-formato-nuevo.md). Aquí sólo está **el orden**
> y **por qué**.

## 0. Cómo se decide si una aseguradora es cara o barata

No por la marca. Por **una sola medición**, y por eso este documento existe:

> **¿El PDF oficial ya trae campos AcroForm, y los nombró la ASEGURADORA?**

Las dos cosas juntas ⇒ barato (AXA, GNP). Falta alguna ⇒ hay que ponerle los campos, o nombrarlos,
o las dos — que es lo que hizo cara a Allianz.

**La vara, con los tres que ya están en prod:**

| | nombres opacos |
|---|---|
| GNP | **2 %** |
| AXA | **10 %** |
| **Allianz** | **~84 %** (61 de 73) ⇒ hubo que escribir `ETIQUETAS_ALLIANZ` a mano |

Un nombre cuenta como **opaco** si no dice qué es: default del generador (`Text Field 246`,
`Casilla de verificación 11`, `Group10`, `undefined_2`), el título del documento más un número
(`informe medico 47`), puro número, o menos de 4 letras.

> 🔎 **Y la primera versión de esa medición MINTIÓ.** Contaba `informe medico 47` y `undefined_2`
> como nombres BUENOS, y con eso Plan Seguro salía en **0 %** — el formato más barato de todos.
> Son defaults del generador, tan opacos como `Text Field 246`; corregido, Plan Seguro es **67 %**.
> Es la lección de esta carpeta aplicada a la herramienta de medir: *un rótulo pobre se ignora,
> uno FALSO se obedece* — y aquí el rótulo falso iba a decidir el orden de trabajo.

---

## 1. TIER 1 — baratas. Misma forma que AXA/GNP

Se hacen primero. El PDF ya trae campos y la aseguradora los nombró.

| | Versión | Campos | Texto | Opacos | Trampas medidas |
|---|---|---|---|---|---|
| **Ve por Más (BX+)** | `SM008` (2017, mod 2021) | 113 | 86 | **20 %** | ninguna conocida |
| **MetLife** | `CC-1-020 VER5` (2022) | 164 | 133 | 33 % | 43 `maxLength`; la fecha va en **tres cajas** (`D1`/`M1`/`A1`) |
| **SURA** | (2025) | 106 | 82 | 34 % | 19 `maxLength`, varios `max=1` |

### ✅ El bloqueador COMPARTIDO del tier 1 — resuelto el 2026-08-21

Las tres rotulan sus recuadros por la **IZQUIERDA** y el motor suponía «derecha», así que cada
casilla salía con la etiqueta de la opción SIGUIENTE. **No era una por aseguradora: era una sola
suposición del motor, y las tres la rompen.** Arreglado midiendo el lado **por grupo, con la mayoría
de la hoja como red** ([`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §7d): AXA/Allianz/GNP idénticos
(49 · 33 · 19 opciones, 13 · 12 · 5 al asistente) y las tres nuevas resolviendo el 100 %
(27 · 31 · 25).

⚠️ **La primera versión del arreglo rotulaba un `Sí` de MetLife como `No`** — el empate caía a un
`der` fijo. Lo encontró el `/code-review`; está en §7d porque es la clase de error que este
mecanismo existe para no cometer.

⚠️ **Ve por Más: 27 grupos de opción y el asistente ve CERO.** Todos son de una sola opción, que es
la regla 2 de `casillasParaElAgente()` (el modelo sólo puede MARCAR, nunca negar). No es un
bloqueador —el doctor las marca a mano— pero hay que decirlo en la UI, no dejar que lo descubra.

🔴 **SURA trae opciones como campos de TEXTO de un carácter** (`Si`, `No_3`, `Urgencia`,
`Hospitalaria` con `maxLength=1`): se contesta escribiendo una `X`, no marcando una casilla. El
motor nunca ha visto eso. Es la misma familia que los RADIOS de GNP: un tipo de pregunta que no es
del tipo que el motor espera. **Medirlo antes de escribir el diccionario.**

## 2. TIER 2 — traen campos, pero los nombres los tendríamos que poner nosotros

| | Versión | Campos | Texto | Opacos | El problema |
|---|---|---|---|---|---|
| **Zurich** | (2020) | 86 | 71 | 48 % | **sólo radios** (15 grupos), todos `Group10`, `Group11`… |
| **Monterrey NYL** | (2025) | 201 | 160 | 53 % | 15 `/Rect` invertidos · 4 capas opcionales · nombres basura (`telwqq`, `26`, `65`) |
| **BBVA** | (2021) | 81 | 49 | 59 % | on-states **mojibake**: `/CesÃ¡rea`, `/CÃ¡ncer` |
| **Plan Seguro** | `DMD-FORIMD` (2026) | 237 | 202 | 67 % | los nombres son el título del doc + un número |
| **Bupa** | `MEX-FREC-V23.01` (2023) | 115 | 88 | **100 %** | todo es `Text Field 246` · además 5 campos de FIRMA |

### 🔴 Y aquí está el hallazgo que REORDENA la lista

`ETIQUETAS` —el mapa `nombre del campo → lo que dice la HOJA`, que llevó a Allianz de 61 campos
ilegibles a 7— **lo genera únicamente el subcomando `campos`, que es el camino del PDF PLANO**
(`alta-formato.ts`, el bloque que imprime `export const ETIQUETAS`). Un PDF que **ya trae campos**
con nombres opacos **no tiene hoy ninguna derivación automática**.

⇒ **Bupa y Plan Seguro son, ahora mismo, MÁS caros que un formato plano.** Un plano se auto-rotula;
los suyos serían **88 y 135 etiquetas tecleadas a mano** mirando la hoja.

💡 **El arreglo es chico y no inventa nada:** el motor de vecindad ya rotula las casillas de AXA
(49 de 49) y las de Allianz desde los `□` impresos. Es apuntarlo a los `rect` de los campos de
TEXTO en vez de a las rayas dibujadas. **Un cambio destraba Zurich, Monterrey, BBVA, Plan Seguro y
Bupa a la vez** — por eso va ANTES que el tier 2, y no se teclean 300 etiquetas.

## 3. TIER 3 — PLANOS. Tratamiento Allianz completo

| | Versión | Estado |
|---|---|---|
| **Inbursa** | `F-347-3` (creado **2002**, mod 2003) · variante 2015 | **0 campos** — plano |
| **Seguros Banorte** | (2014) | **0 campos** — plano · páginas 654×834 |
| ~~**Monterrey NYL** hoja vieja~~ | (2017), 2 págs, 640×820 | plano — **superseded** por su hoja de 2025 del tier 2 |

⚠️ **Inbursa es de 2002.** Antes de construir nada hay que confirmar que es el vigente: es
exactamente el riesgo de Allianz (su hoja de un tercero estaba 7 años atrasada) y mandar un formato
obsoleto es lo que esta funcionalidad existe para evitar.

## 4. Otras

| | Estado |
|---|---|
| **AXA — cirugías** (`GMM_Formato_Informe_Medico_AXA`, 2018) | ✅ bajado · 162 campos (132 texto · 30 casillas) · 5 págs · 32 `maxLength`. Es **otra hoja de la MISMA aseguradora**: el motor ya es agnóstico, así que sale barata |
| **Seguros Atlas** (`INFORME MEDICO FF-284`) | 🔴 **NO se pudo bajar**: el servidor devuelve una página HTML de reto en vez del PDF, con y sin `Referer`. Hace falta el navegador o que lo baje el usuario |
| **Pan-American (PALIG)** | 🔴 No hay informe médico publicado; parece ser sólo de portal de agentes |
| **Multiva · Latinoamericana · Prevem · «sisnova»** | ⏸️ **Nombres sin confirmar con el usuario.** No se buscan a ciegas: bajar la hoja de la aseguradora equivocada es el peor error posible aquí |

---

## 5. De dónde se bajó cada PDF (2026-08-21)

`insurance_forms` exige `source_url` + `fetched_at` (03-FORMATOS §5). Éstas son las URLs, todas
del dominio de la aseguradora:

| | URL |
|---|---|
| Ve por Más | `https://www.vepormas.com/fwpf/storage/02_informe_medico_GMM_SM008.pdf` |
| MetLife | `https://www.metlife.com.mx/content/dam/metlifecom/mx/pdfs/common-files/CC-1-020-VER5.pdf` |
| SURA | `https://www.segurossura.com.mx/wp-content/uploads/2025/03/Informe-Medico-SURA.pdf` |
| Zurich | `https://www.zurich.com.mx/-/media/project/zwp/mexico/docs/regulaciones/formatos-y-solicitudes/vida-2020/formato-informe-medico_sinr.pdf` |
| Monterrey NYL (2025) | `https://www.segurosmnyl.com.mx/Portals/5/DescargasFolleto/InformeMedico.pdf` |
| Monterrey NYL (2017, plano) | `https://www.mnyl.com.mx/sharedassets/pdf/formato-informe-medico.pdf` |
| BBVA | `https://www.bbva.mx/content/dam/public-web/mexico/documents/personas/seguros/informe-medico.pdf` |
| Plan Seguro | `https://www.planseguro.com.mx/docs/formatos_tramites/tramites-medicos/ago21/Informe_medico-DMD-FORIMD-250617-V08.pdf` |
| Bupa | `https://www.bupasalud.com.mx/sites/default/files/2023-02/bloques/anexos/MEX-Formulario-de-Reclamacion-2023-Fill.pdf` |
| Inbursa | `https://www.segurosinbursa.com.mx/segurosinbursa/gmm/siniestros/pdf/informe2.pdf` |
| Banorte | `https://www.segurosbanorte.com.mx/descargas/seguros/formatos/gmm/InformeMedico[2].pdf` |
| AXA cirugías | `https://axa.mx/documents/10928/13960074/GMM_Formato_Informe_Medico_AXA.pdf` |
| Atlas (**no se pudo**) | `https://www.segurosatlas.com.mx/Documentos/GASTOS_MEDICOS/Formatos_y_Solicitudes/INFORME%20MEDICO%20FF-284-PDF.pdf` |

⚠️ **Los PDFs bajados viven en el scratchpad de la sesión, NO en el repo.** Sólo entra a
`public/formatos/` el de la aseguradora que se esté dando de alta, en su commit.

## 6. El orden acordado con el usuario (2026-08-21)

1. **Tier 1**, una por una, un commit cada una: **Ve por Más → MetLife → SURA**.
2. La derivación de etiquetas para un PDF **con campos** y nombres opacos (§2).
3. **Tier 2**, ya destrabado.
4. **Tier 3** (planos) y las que falten por confirmar.

🔴 **Y lo que no cambia por ser la aseguradora #4:** cada formato nuevo trae **una suposición del
motor que resulta ser falsa** (08-ALTA §7). Con GNP fueron cuatro y ninguna la alcanzaron los gates
ni el type-check, porque las cuatro dan una hoja que **se ve perfectamente normal**. Aquí ya hay dos
candidatas anotadas antes de empezar: los campos de texto de 1 carácter de SURA y el mojibake de
BBVA.
