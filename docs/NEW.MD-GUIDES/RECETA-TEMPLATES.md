# Recetas desde plantillas custom (FormBuilder)

**Shipped:** 2026-07-18 · **Migración:** `packages/database/prisma/migrations/add-receta-templates.sql` (aplicada a prod 2026-07-18, smoke verificado)

## Qué es

Las plantillas custom del FormBuilder (`/dashboard/medical-records/custom-templates`) ganan un
tercer destino además de consultas y formularios pre-cita: **recetas**. Una plantilla marcada
"Usar como plantilla de receta" (`encounter_templates.is_receta`) aparece en el selector "Tipo de
Receta" de Nueva Receta y **REEMPLAZA el formulario fijo** (diagnóstico/notas/medicamentos/
estudios) con sus propios campos. La receta guarda `prescriptions.template_id` + `custom_data`
(JSONB, valores por `FieldDefinition.name`) en lugar de renglones de medicamentos.

## Decisiones de diseño (usuario, 2026-07-18)

1. **Reemplazo total, no campos adicionales** — la plantilla ES el contenido de la receta.
2. **El esqueleto legal es SIEMPRE automático**: doctor (nombre + cédula + firma), paciente,
   fecha y clínica se renderizan en el PDF desde el perfil/registro, independiente de la
   plantilla — la plantilla no puede omitirlos.
3. **La receta estándar queda intacta y es el default** — sin plantillas receta, nada cambia.
4. Toggles de plantilla son ADITIVOS (convención existente de `isPreAppointment`): una plantilla
   receta también aparece en el selector de consultas si el doctor así lo quiere.
5. Chat IA / voz quedan ocultos en modo plantilla (editan los campos fijos). Follow-up posible:
   `custom-template-prompts.ts` ya da voz a plantillas custom de consultas.
6. **El agente NO se toca** — recetas son tier clínico (frontera de 02-CAPACIDADES); cero tools,
   cero evals, cero prompt.

## Guards (viven en endpoints, no solo UI)

- POST prescriptions: plantilla debe ser del doctor + `isReceta` + activa (re-validada al
  submit, no al load); campos required validados server-side contra la definición ACTUAL.
- Issue: acepta `customData` no-vacío como contenido en lugar de medicamentos.
- DELETE custom-templates: cuenta recetas además de encounters — plantilla usada se desactiva
  (soft), nunca hard-delete (una receta emitida está legalmente bloqueada y su PDF resuelve
  labels desde la plantilla; FK es `SET NULL` como último recurso, el PDF cae a raw keys).
- PUT prescriptions: `customData` editable solo en drafts; `templateId` inmutable.

## Review (05-METODO, modo B inline, 2026-07-18)

- CONFIRMED corregido durante el build: cambiar de plantilla dejaba valores stale de la
  plantilla anterior en `customData` → reset al seleccionar.
- PLAUSIBLE aceptados (watch items): campo tipo `file` en PDF renderizaría "[object Object]"
  (no hay plantillas receta con file aún) · listas/timeline muestran "0 medicamentos" para
  recetas de plantilla (cosmético) · resolución de labels triplicada (encounter-pdf, PDF
  receta, detail page) — candidata a helper compartido, misma familia que receiver-derivation.
- Gates: tsc doctor limpio ×2 · smoke read-only vs prod de los 3 query shapes nuevos
  (findFirst isReceta, _count.prescriptions, include template) post-migración · sin evals
  (agente intacto).
- Pendiente: validación en vivo (crear plantilla → receta → emitir → PDF; el render del PDF es
  lo único no verificable pre-deploy) · pase multi-agente opcional (`/code-review ultra`) como
  segunda capa de ojos frescos — feature de documento legal.
