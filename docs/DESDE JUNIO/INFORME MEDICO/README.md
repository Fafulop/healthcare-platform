# 📄 INFORME MÉDICO — llenar el formato de la aseguradora desde el expediente

> **Índice de la carpeta.** Tipo **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.
> Abierta el **2026-08-08** a pedido del usuario.

## En una frase

El doctor elige el formato de una aseguradora de una lista, el sistema **lo pre-llena con lo que
ya sabe del paciente y de la consulta**, el doctor corrige (tecleando o hablándole al LLM), y sale
un **PDF idéntico al oficial de la aseguradora** para descargar o mandarle al paciente.

## ✅ Estado (2026-08-15): **EN PROD con DOS aseguradoras; la TERCERA construida**

| | |
|---|---|
| Tablas + columnas de póliza · `schema.prisma` | ✅ **EN PROD** |
| Motor de PDF (llenar · aplanar · borrador · alta de formato plano) | ✅ **EN PROD** |
| Endpoints · pantalla · visor · pre-llenado determinista | ✅ **EN PROD** |
| Chat sobre la hoja · informe a nivel PACIENTE con fuentes elegidas | ✅ **EN PROD** |
| **AXA** — GMM Informe Médico (277 campos, el oficial ya venía rellenable) | ✅ **EN PROD y en uso** |
| **Allianz** — GMM Informe Médico (oficial PLANO ⇒ 87 campos puestos por nosotros) | ✅ **EN PROD**, poco probado a mano |
| **GNP** — Informe Médico GMM (oficial, 62 campos: 55 texto + **7 radios**) | 🟡 **construido y verificado con el motor**; falta sembrar la fila, desplegar y MIRARLO |

🔴 **Y GNP obligó a tocar el motor**, que hasta ahora sólo sabía de texto y casillas: **grupos de
RADIO** (7 preguntas de la hoja, incluido el sexo), **rects invertidos** (4 widgets con alto
negativo — uno no se podía escribir), **texto en una capa apagada** y **nombres de opción
escapados** (`Opci#F3n2`). Las cuatro dan una hoja que se ve normal y ningún gate las alcanza:
[`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §7.

⚠️ De paso salió que **AXA y Allianz imprimían el nombre del médico incompleto** para los doctores
cuyos apellidos viven en `Doctor.lastName` (3 de 11 en prod). Corregido con una sola regla para las
tres aseguradoras.

👉 **Para agregar la aseguradora #3, el documento es
[`08-ALTA-de-un-formato-nuevo.md`](08-ALTA-de-un-formato-nuevo.md)**: las 4 piezas que hay que
tocar, la herramienta (`scripts/alta-formato.ts`) y las trampas que ya mordieron una vez.

🔴 **`prisma db push` REVIERTE TRES cosas que viven sólo en prod** y que Prisma no sabe modelar:
la **FK compuesta** `(patient_id, doctor_id)`, el **índice único parcial** de versión vigente, y
la FK **`DEFERRABLE`** de `encounter_id` (sin la cual **borrar un paciente truena**). Las tres
están comentadas en `schema.prisma` y viven en
`packages/database/prisma/migrations/create-informe-medico.sql`.

## Los hallazgos del primer día (2026-08-08, histórico)

**1. No son escaneos.** Se midieron 3 formatos reales (Allianz, AXA, GNP): traen **campos
rellenables**, capa de texto, sin cifrar, sin XFA, sin rotación. Llenar por nombre de campo es
mucho más barato que estampar coordenadas ([`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §2).

**2. 🔴 Pero esos PDFs venían de Eleonor (`eleonor.mx`), no de las aseguradoras — y dos están mal.**
Comparados contra el sitio oficial de cada aseguradora
([`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md)):

| | Veredicto |
|---|---|
| **AXA** | ✅ Mismo documento. **El oficial ya es rellenable** (277 campos) — usar ése |
| **GNP** | ⚠️ El del tercero (3 pág) y el oficial (2 pág) son **documentos distintos**. ✅ **Resuelto 2026-08-15: rige el oficial** |
| **Allianz** | 🔴 El del tercero es de **2016**; el oficial es de **2023**. Y el oficial es **plano** |

⇒ **DECIDIDO: el PDF base se baja del dominio de la aseguradora.** v1 arranca con estas 3.
Mandar un formato obsoleto es justo el riesgo que esta funcionalidad existe para evitar.

**3. ✅ Y el motor de salida ya está probado — con el clic** (2026-08-08): `pdf-lib` llenó **10/10**
campos del AXA oficial, `flatten()` dejó **0 campos vivos**, los acentos y la ñ sobrevivieron
(`Muñoz`, `Peña`, `María de los Ángeles`), y **el usuario abrió el PDF: se ve bien y no se puede
editar**. Detalle en [`SESSION-REFRESCO`](SESSION-REFRESCO.md).

## Los documentos

| | |
|---|---|
| 👉 [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **EMPIEZA AQUÍ** — estado vivo, decisiones tomadas y las preguntas abiertas |
| [`01-FUENTES-de-donde-sale-cada-campo.md`](01-FUENTES-de-donde-sale-cada-campo.md) | **El documento importante.** De dónde sale cada valor, y por qué la consulta NO tiene un esquema fijo |
| [`02-PLAN-el-formato-y-los-pasos.md`](02-PLAN-el-formato-y-los-pasos.md) | Qué se midió en los PDFs reales (§2), el diccionario de campos (§3), las tablas y los 7 pasos |
| [`03-FORMATOS-procedencia-y-versiones.md`](03-FORMATOS-procedencia-y-versiones.md) | **De dónde bajar el PDF y por qué el del tercero no sirve** — oficial vs. intermediario, formato por formato |
| [`04-MAPEO-expediente-a-formato.md`](04-MAPEO-expediente-a-formato.md) | Qué columna llena qué campo de cada formato · el **canónico** intermedio · **lo que NO podemos llenar** |
| [`05-VOZ-el-doctor-le-dicta-al-formato.md`](05-VOZ-el-doctor-le-dicta-al-formato.md) | El dictado contra la hoja. **Superado por el chat** (06), se conserva por sus reglas |
| [`06-AGENTE-conversar-con-el-formato.md`](06-AGENTE-conversar-con-el-formato.md) | El chat sobre la hoja: **la hoja ES el card**. En prod |
| [`07-PLAN-informe-a-nivel-paciente.md`](07-PLAN-informe-a-nivel-paciente.md) | Informe a nivel PACIENTE con fuentes elegidas. En prod |
| 👉 [`08-ALTA-de-un-formato-nuevo.md`](08-ALTA-de-un-formato-nuevo.md) | **CÓMO AGREGAR UNA ASEGURADORA.** Las 4 piezas, la herramienta y las trampas |

## De dónde viene este pedido

Del usuario, el 2026-08-08:

> *"Una funcionalidad en expediente que se llama informe médico. El doctor puede escoger de un
> dropdown de muchos PDFs que contienen las estructuras que necesitan las aseguradoras, para
> llenarlas y mandarlas a la aseguradora o al paciente, para que le cubran gastos."*

Y la precisión que define el diseño, del mismo día:

> *"Las consultas pueden tener diferentes esquemas, no todas caen bajo la arquitectura SOAP. Los
> doctores pueden crear los suyos."*

## Lo que ya está decidido

| Decisión | Cuál | Dónde se explica |
|---|---|---|
| Formato de edición | **JSON, nunca PDF.** El PDF es una SALIDA, no una superficie de captura | [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §1 |
| Fidelidad del PDF | **Idéntico al oficial** — y sale barato: los formatos **ya traen campos rellenables** | [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §2 |
| Entrega | **Descarga** + **link al paciente**. NO se le manda correo a la aseguradora en v1 | [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §5 |
| Llenado | Los CUATRO: automático de la ficha · automático de la consulta · voz+LLM · manual | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) |

## Lo que NO se re-litiga

🔴 **El PDF jamás es la superficie de captura.** Se teclea sobre un formulario HTML contra un JSON;
el PDF se genera al final. Un PDF editable no se puede pre-llenar, ni validar, ni leérselo al LLM,
ni re-emitir para una segunda aseguradora.

🔴 **Un campo sin fuente se queda VACÍO y marcado.** Nunca se adivina. Este documento lo firma un
médico y va a una aseguradora: un dato inventado con formato correcto es peor que un hueco, porque
el hueco se ve y la invención no. Mismo criterio que
[`../../AGENTES/`](../AGENTES) sobre no dejar que el modelo deduzca veredictos.

🔴 **Cada campo llenado carga de dónde salió.** No es lo mismo copiar `patient.dateOfBirth` que un
valor que el LLM sacó interpretando el `customData` de una plantilla que inventó el doctor. El
doctor tiene que VER la diferencia antes de firmar ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §4).

## Lo que toca de lo que ya existe

Casi todo está construido para otras cosas y se reusa:

| Pieza | Dónde vive |
|---|---|
| Definición de campos (`FieldDefinition`) | `apps/doctor/src/types/custom-encounter.ts` |
| Editor visual de formularios | `apps/doctor/src/components/form-builder/` (Canvas, ConfigPanel, PreviewMode) |
| LLM que edita formularios conversando | `form-builder/AIChatPanel.tsx` + `hooks/useFormBuilderChat` |
| Voz | `apps/doctor/src/components/voice-assistant/` |
| PDF | `lib/pdf/encounter-pdf.ts` (jsPDF) · `lib/pdf/PrescriptionTemplate.tsx` (@react-pdf/renderer) |
| Render de un PDF a canvas | `pdfjs-dist` (declarado, ver abajo) |
| Link con token al paciente | `apps/public/src/app/formulario-cita/[token]/page.tsx` |
| Resolver claves crudas → etiquetas | `lib/receta-custom-content.ts` — **el precedente exacto** |

### Las dependencias, ya resueltas

`pdf-lib@^1.17.1` y `pdfjs-dist@^5.4.296` están declaradas en `apps/doctor/package.json` con el
`pnpm-lock.yaml` regenerado en el mismo commit. ⚠️ La lección se conserva porque vuelve a aplicar
a cualquier dependencia nueva: `pdfjs-dist` sólo existía como transitiva de `pdf-parse`, funcionaba
en local por la ruta larga de `.pnpm`, y habría tronado con `MODULE_NOT_FOUND` en el build.

