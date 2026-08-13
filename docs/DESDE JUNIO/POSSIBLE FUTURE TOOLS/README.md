# 🔮 Herramientas posibles a futuro

> **Qué es esto.** Un cajón de IDEAS dictadas el **2026-08-13**, no un plan. Nada de lo que
> sigue está diseñado, estimado ni aprobado: son dos flujos que el doctor quiere explorar,
> escritos aquí para que no se pierdan. Cuando alguna se tome en serio, se le abre su propia
> carpeta con el formato de siempre (`00-…`, `SESSION-REFRESCO.md`, etc.).
>
> ⚠️ **No hay código de esto.** Si alguien llega aquí buscando implementación, no existe.

---

## 1. Ficha visual para el paciente (PDF con gráficas, generado por LLM)

**La idea.** Que el doctor pueda producir un documento **visual** para explicarle algo a un
paciente, sin diseñarlo él.

**Entrada** — cualquiera de estas tres:
- una **plantilla** (o un "estudio") ya definida,
- una **imagen o un PDF** que el doctor sube (un estudio, un laboratorio, una radiografía),
- o simplemente una **descripción escrita** por el doctor.

**Proceso.** Eso se le pasa a un LLM, que arma el contenido.

**Salida.** Un **PDF con gráficas / diagramas** sobre lo que el doctor describió o entregó,
pensado para **presentárselo al paciente** — una forma más interactiva de explicar que un texto
corrido o el estudio crudo.

**Preguntas abiertas (para cuando se retome):**
- ¿El PDF se guarda en el expediente del paciente, se comparte por link, o las dos?
- ¿Qué tipos de gráfica tienen sentido de verdad en consulta (evolución en el tiempo,
  comparativos contra rangos de referencia, anatómicos)?
- **Riesgo clínico:** un LLM graficando valores de un estudio puede EQUIVOCAR una cifra, y esto
  se le enseña al paciente. Hace falta que el doctor revise y apruebe antes de que exista el
  PDF — el mismo patrón de propuesta → revisión → confirmación que ya usa el asistente.
- ¿Se apoya en el motor de PDFs que ya existe (recetas, informe médico) o es uno nuevo?

---

## 2. Plantilla derivada de otra (para seguimientos)

**El problema.** En un seguimiento, el doctor vuelve a escribir un montón de información que ya
había capturado en la consulta anterior del MISMO paciente.

**La idea.** Una plantilla que se **monta sobre otra**. El flujo:

1. El doctor dispara el flujo desde una plantilla ya existente.
2. Elige **qué campos de la original se arrastran**, con casillas — y de forma gruesa también:
   traer el **100 %**, el **80 %**, el **50 %** de la original.
3. Sobre eso **agrega campos nuevos**, los propios del seguimiento.

**El resultado.** Al usar esa plantilla derivada con un paciente, **jala la información que ya
tenía de la consulta anterior** y el doctor sólo llena lo nuevo. Menos recaptura, menos error
de transcripción.

**Dónde encaja hoy.** Las plantillas ya existen: `EncounterTemplate` (`customFields`,
`fieldVisibility`, `defaultValues`) y su UI en
`dashboard/medical-records/custom-templates`. Esta idea es una relación NUEVA —
plantilla derivada de plantilla— más el arrastre de VALORES de una consulta previa.

**Preguntas abiertas (para cuando se retome):**
- ⚠️ **Lo más importante:** ¿se arrastran los **campos** (la estructura) o los **valores** de la
  consulta anterior? La frase "no tener que volver a escribir lo mismo" apunta a los VALORES,
  y eso es bastante más delicado: copiar contenido clínico viejo a una nota nueva puede
  perpetuar un dato que ya no es cierto. Habría que marcar visualmente qué viene arrastrado y
  obligar a confirmarlo.
- El "50 % / 80 %" ¿es sólo un atajo para marcar casillas en bloque, o significa algo más?
- ¿La plantilla derivada queda **ligada** a la original (si cambia la madre, cambia la hija) o
  es una copia independiente?
- ¿Sólo entre consultas del MISMO paciente, o también sirve para reusar la estructura entre
  pacientes distintos?

---

*Dictado por el doctor el 2026-08-13, al cierre de la sesión de facturación del expediente.*
