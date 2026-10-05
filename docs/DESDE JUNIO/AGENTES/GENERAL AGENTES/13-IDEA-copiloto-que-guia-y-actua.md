# 🧑‍✈️ IDEA — un copiloto «tipo Jarvis» que guía y actúa dentro de la app

> **Tipo: IDEA / ANÁLISIS.** 🌱 **NADA CONSTRUIDO, NADA DECIDIDO** (2026-10-05). Se escribió para que
> la idea no se pierda; el usuario la quiere entendida, no empezada. Antes de construir cualquier
> parte hay que pasarla a un PLAN con su propio §"verificar contra el código" (`08-EMPIEZA-AQUI` §8:
> *la verdad es el código*).

---

## 0. En una frase

Un asistente del **doctor** con el que se puede hablar (texto o voz) y que **contesta haciendo**:
lleva a la pantalla correcta, señala el siguiente botón, abre la ventana que toca y —con el tap del
doctor— ejecuta; su conocimiento de «cómo se hace cada cosa» son **las guías paso a paso** de Ayuda,
y sus manos son **acciones que la app expone a propósito**, no clics sobre píxeles.

## 1. De dónde sale

En la pasada de pruebas de octubre (`../../PRUEBAS Y GUIAS/`) Claude Code probó la app en producción
manejando Chrome: abría pantallas, llenaba formularios, leía PDFs, confirmaba en la BD. Funcionó, y
el usuario se preguntó: **¿por qué el doctor no puede tener algo así desde la propia app**, sin
instalar ni disparar una extensión?

Lo que esa misma experiencia enseñó sobre **cómo NO hacerlo**:

| Lo que pasó manejando Chrome desde afuera | Lo que significa para un copiloto interno |
|---|---|
| Clics por coordenada que caían en otro lado al cambiar el tamaño de la ventana | No manejar la UI por posición: usar acciones con nombre |
| Un clic «por referencia» que cayó en un radio y no en «Guardar Cambios» | El agente no debe adivinar el elemento: la app le dice cuál es |
| Capturas que expiraban mientras la vista previa de «Receta PDF» se redibujaba (H-068) | Leer el estado por datos, no por imagen |
| El primer clic después de cargar se perdía | El agente necesita saber cuándo la pantalla está lista |

**Conclusión:** desde afuera, una IA tiene que *mirar* la pantalla. Desde adentro, **la app puede
decirle qué hay y darle palancas**. Es más rápido, más barato por turno y no se rompe cuando cambia
el diseño.

## 2. Lo que ya existe y se reusa (no se empieza de cero)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| **El asistente** (5 módulos, tools de lectura y de propuesta) | `apps/doctor/src/lib/agenda-agent/` · `02-CAPACIDADES` | El cerebro y las «manos de datos». Conteos vigentes: SÓLO `02-CAPACIDADES` §4 |
| **Las 3 reglas** (lecturas autónomas · escrituras propuesta → card → el doctor confirma → el cliente ejecuta · regla 0 server-side) | `08-EMPIEZA-AQUI` §1 | Lo que hace seguro dejarlo actuar. **No cambian** |
| **Las 27 guías paso a paso** | `apps/doctor/src/lib/ayuda/guias/` (pestaña «Flujos» de Ayuda, H3 `4ae65b16`) | El «cómo se hace»: pantalla, etiqueta exacta del botón, qué se ve, qué pasa con el dinero. Ya se verifican contra el código (`apps/doctor/scripts/ayuda-guias-check.ts`) |
| **El widget «?»** (manual completo en el prompt, `gpt-4o-mini`) | `../../AYUDA WIDGET/` | El «qué es cada cosa». Su paso G3 (enlazar guías) es un escalón natural hacia esto |
| **Contexto de pantalla** — que el asistente sepa qué pantalla y qué entidad tiene abierta el doctor | `11-ANALISIS-contexto-de-pantalla.md` · `12-PLAN-contexto-de-pantalla.md` (nada construido) | Los «ojos». **Prerrequisito** de casi todo lo de abajo |
| **Exploración de voz** (ElevenLabs Modo 1/2) | `../AGENTE ELEVENLABS/` | La «boca y oídos». Esa carpeta es para PACIENTES por teléfono; aquí sería para el DOCTOR dentro de la app, pero el Modo 2 (ElevenLabs sólo hace STT/TTS y el cerebro es nuestro) aplica igual |

## 3. La arquitectura, en capas

```
 voz (STT/TTS) ─┐                                   ← opcional, encima de todo (fase 3)
 texto ─────────┴─▶ el asistente (mismo loop)
                     │  sabe:   manual (qué es) + guías (cómo se hace) + pantalla actual (dónde está)
                     │  manos:  ① acciones de INTERFAZ  ② tools de DATOS (las de hoy)
                     ▼
     ① navegar · abrir ventana · resaltar · prellenar      ② leer · proponer → card → tap → ejecuta
        (sólo cliente, NO escriben nada)                       (sin cambios)
```

**① Acciones de interfaz — lo nuevo.** Un registro en el cliente de cosas que la app sabe hacer
sola, con nombre y parámetros: `ir_a(pantalla, entidad)`, `abrir(ventana, entidad)`,
`resaltar(control)`, `prellenar(formulario, campos)`. No escriben en la BD — prellenar un
formulario deja todo listo y el doctor aprieta el botón. Por eso **pueden ser autónomas** igual que
las lecturas (regla «lecturas autónomas»).

**Cómo se conectan las guías:** cada paso de una guía nombra una pantalla y un control por su
etiqueta exacta («Mis Citas» → «Completar»). Si cada control relevante de la app lleva un
identificador estable (p. ej. `data-guia="completar-cita"`), una guía se vuelve **ejecutable**: el
asistente recorre sus pasos llamando `ir_a` / `resaltar` / `abrir`. El check de guías ya garantiza
que la etiqueta existe; el mismo check podría garantizar que el identificador existe.

## 4. Por fases (cada una sirve sola)

| Fase | Qué | Escribe datos | Depende de |
|---|---|---|---|
| **F0** | Contexto de pantalla (el plan 12, tal cual) | No | — |
| **F1 — modo guiado** | «¿Cómo cobro esta cita?» → el asistente abre la cita, resalta «Completar», explica el monto y la forma de pago **según la guía A6-A7**, y el doctor hace el clic | **No** | F0 + registro de acciones de interfaz + identificadores en los controles de las guías más usadas |
| **F2 — hace por ti, con tu tap** | «Cobra esta cita en efectivo, 700» → abre «Completar cita» **ya prellenada**; el doctor confirma | Sólo con tap (igual que hoy) | F1 |
| **F3 — voz** | Lo mismo hablado (manos ocupadas en consulta). STT/TTS comprado (ElevenLabs Modo 2 o una API de voz en tiempo real); el cerebro sigue siendo el nuestro | Sólo con tap | F1/F2 |
| **F4 — flujos de varios pasos** | «Agéndale seguimiento en 2 semanas y mándale el formulario» → encadena acciones y propuestas | Sólo con tap, una card por escritura | F2 + evals de cadenas |

**F1 es la más barata y la de más valor:** no escribe nada (riesgo bajo), reusa las guías tal cual y
construye exactamente el mecanismo (acciones de interfaz + identificadores) que las fases de arriba
necesitan.

## 5. Reglas que no cambian (y una que se agrega)

- **Escrituras = propuesta → card → el doctor confirma con un tap → el cliente ejecuta.** También
  con voz: un «sí» mal escuchado **no** completa una cita, no cobra ni emite una factura. La voz
  puede *preparar*; el tap *confirma*.
- **Regla 0:** los veredictos de negocio (¿está pagada?, ¿se puede completar en $0?, ¿hay cupo?) los
  decide el servidor, no el modelo.
- **Permisos y plan recortan también las acciones de interfaz:** un ayudante sin `flujo` no puede
  ser llevado a Flujo de Dinero; el mismo resolver de scope que recorta tools (`02-CAPACIDADES` §1.5).
- **Nuevo:** una acción de interfaz **nunca escribe**. Si algún día una necesita escribir, deja de ser
  acción de interfaz y pasa a ser tool con card.

## 6. Costos y riesgos honestos

1. **Dinero por doctor.** Voz (por minuto) + modelo (por turno) en un producto barato. Tiene que caber
   en los topes de IA por plan que ya existen (TIERS P3, `e5f35e3a`); medir con minutos reales antes
   de prometer voz.
2. **Las guías se vuelven infraestructura.** Una guía vieja confunde a un doctor; una guía vieja
   dentro del agente lo hace **afirmar con seguridad** un botón que no existe. El check de guías tiene
   que correr en cada cambio de UI que las toque (hoy es manual).
3. **Privacidad (LFPDPPP 2025).** Voz con datos clínicos: no grabar audio por default, decir qué se
   procesa y dónde (el proveedor de STT ve el audio); revisar con `project_legal_compliance`.
4. **Evals nuevas.** Hoy las evals miran tools y respuestas; habría que evaluar también qué acciones
   de interfaz pidió y en qué orden (y que nunca pida una fuera de su scope).
5. **Latencia en voz.** Una respuesta hablada que tarda 4 s se siente rota; F3 no antes de medir.

## 7. Preguntas abiertas (para cuando se retome)

- ¿F1 vive en el panel del asistente o en el widget «?» (que ya tiene manual y será el que enlace
  guías)? Hoy son dos cosas distintas con modelos distintos (`gpt-4o-mini` vs el del asistente).
- ¿Qué controles llevan identificador estable primero? Propuesta: los que nombran las guías más
  usadas (agendar, completar, cobrar con link, nueva visita, receta).
- ¿Voz para el doctor desde el navegador (micrófono) o también por teléfono (como la exploración de
  ElevenLabs para pacientes)?
- ¿Cómo se ve «resaltar»? (contorno + flecha, oscurecer el resto, un globo con el texto del paso).

---

*Relacionados: `11-ANALISIS-contexto-de-pantalla.md` · `12-PLAN-contexto-de-pantalla.md` ·
`../AGENTE ELEVENLABS/README.md` · `../../AYUDA WIDGET/02-PLAN-construccion.md` (G3) ·
`../../PRUEBAS Y GUIAS/` (de dónde salieron las guías).*
