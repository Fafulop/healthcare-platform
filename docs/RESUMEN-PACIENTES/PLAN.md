# Resumen de Paciente con IA — Plan de Implementacion

## Objetivo

Permitir que un doctor, desde la pagina del expediente de un paciente (`/dashboard/medical-records/patients/[id]`), vea y genere un **resumen clinico** creado por un LLM. El resumen se persiste en la base de datos y se muestra en una card en la columna derecha (debajo de "Informacion Rapida"). Al hacer click se abre un modal con el resumen completo.

---

## Ubicacion en la UI

```
Pagina del expediente del paciente
/dashboard/medical-records/patients/[id]

┌─────────────────────────────┐  ┌───────────────────┐
│  Columna Izquierda (2/3)    │  │ Columna Der (1/3) │
│                             │  │                   │
│  Informacion de Contacto    │  │ Informacion       │
│  Datos Fiscales             │  │ Rapida            │
│  Contacto Emergencia        │  │                   │
│  Notas Generales            │  │ ─────────────── │
│  Notas Recientes            │  │                   │
│  Historial de Consultas     │  │ Resumen           │
│  Formularios                │  │ Paciente ← NUEVO  │
│  Citas e Ingresos           │  │                   │
│                             │  └───────────────────┘
└─────────────────────────────┘
```

### Card "Resumen Paciente" (columna derecha)

**Estado inicial (sin resumen):**
- Icono + titulo "Resumen Paciente"
- Texto: "No hay resumen generado"
- Boton: "Generar Resumen"

**Estado con resumen existente:**
- Icono + titulo "Resumen Paciente"
- Fecha claramente visible: "Generado el 29 may 2026, 14:32"
- Preview: primeras 3-4 lineas del resumen (truncado)
- Click en la card abre modal con resumen completo
- Boton pequeno: "Regenerar" para crear uno nuevo

---

## Datos Disponibles para el Resumen

| Fuente | Datos clave |
|--------|------------|
| **Patient (baseline)** | Edad, sexo, tipo de sangre, alergias, condiciones cronicas, medicamentos actuales, notas generales, etiquetas |
| **ClinicalEncounter** | Fecha, tipo, motivo de consulta, notas SOAP (subjetivo, objetivo, evaluacion, plan), signos vitales (PA, FC, temp, peso, talla, SpO2), seguimiento |
| **Prescription** | Fecha, diagnostico, estado, medicamentos (nombre, dosis, frecuencia, duracion), estudios de imagen, estudios de laboratorio |
| **PatientNote** | Notas libres del medico con fecha |

---

## Arquitectura

```
Card "Resumen Paciente" en expediente
    |
    |-- Al cargar pagina: GET /api/medical-records/patients/[id]/summary
    |   → Retorna ultimo resumen guardado (o null)
    |
    |-- Click "Generar" / "Regenerar":
    |   POST /api/medical-records/patients/[id]/summary
    |       |
    |       |-- 1. Auth (requireDoctorAuth)
    |       |-- 2. Fetch Patient baseline
    |       |-- 3. Fetch Encounters, Prescriptions, Notes (paralelo)
    |       |-- 4. Formatear como texto plano estructurado
    |       |-- 5. Enviar a OpenAI (gpt-4o)
    |       |-- 6. GUARDAR resumen en tabla PatientSummary
    |       |-- 7. Audit log (generate_ai_summary)
    |       |-- 8. Retornar resumen guardado
    |
    |-- Click en card → abre modal con resumen completo
```

---

## Base de Datos — Nuevo modelo: PatientSummary

### Prisma Schema

```prisma
model PatientSummary {
  id        String   @id @default(cuid())
  patientId String   @map("patient_id")
  doctorId  String   @map("doctor_id")
  content   String   @db.Text          // El resumen generado por el LLM
  dataPoints Json    @map("data_points") // { encounters: N, prescriptions: N, notes: N }
  createdAt DateTime @default(now()) @map("created_at")

  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Cascade)
  doctor    Doctor   @relation(fields: [doctorId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("patient_summaries")
  @@schema("medical_records")
}
```

Solo se guarda el ultimo resumen por paciente. Cuando se regenera, se hace un **upsert** (o delete + create) para reemplazar el anterior.

### SQL Migration

```sql
-- Migration: Add patient_summaries table
-- Purpose: Store AI-generated patient clinical summaries
-- Date: 2026-05-29

CREATE TABLE IF NOT EXISTS medical_records.patient_summaries (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    content TEXT NOT NULL,
    data_points JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT patient_summaries_patient_id_fkey
        FOREIGN KEY (patient_id)
        REFERENCES medical_records.patients(id)
        ON DELETE CASCADE,

    CONSTRAINT patient_summaries_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS patient_summaries_patient_id_idx
    ON medical_records.patient_summaries(patient_id);
```

**Despliegue:** Ejecutar migration en local primero, luego en Railway ANTES de deployar codigo (per database-architecture.md checklist).

---

## Componentes a Crear/Modificar

### 1. API Route (NUEVO)

**Ruta:** `apps/doctor/src/app/api/medical-records/patients/[id]/summary/route.ts`

**GET** — Obtener ultimo resumen guardado
- Auth con `requireDoctorAuth`
- Query: `prisma.patientSummary.findFirst({ where: { patientId, doctorId }, orderBy: { createdAt: 'desc' } })`
- Retorna: `{ data: { id, content, dataPoints, createdAt } }` o `{ data: null }`

**POST** — Generar nuevo resumen con LLM
- Auth con `requireDoctorAuth`
- Fetch patient + encounters + prescriptions + notes (paralelo)
- Construir texto plano estructurado (sin datos fiscales/contacto)
- Llamar a OpenAI gpt-4o con system prompt medico
- Borrar resumen anterior (si existe) y crear uno nuevo
- Audit log (`generate_ai_summary`)
- Retorna: `{ data: { id, content, dataPoints, createdAt } }`

**System prompt — secciones del resumen:**
1. Datos Generales (edad, sexo, sangre, alergias)
2. Antecedentes Relevantes (cronicas, medicamentos base)
3. Resumen de Consultas (sintesis, patrones, evolucion)
4. Diagnosticos Principales
5. Tratamientos y Medicamentos (historial, cambios)
6. Estudios Solicitados (labs e imagen)
7. Signos Vitales Relevantes (tendencias, fuera de rango)
8. Seguimiento Pendiente
9. Observaciones Importantes (riesgos, patrones)

**LLM config:**
- Modelo: `gpt-4o` (ya integrado via `OpenAIChatProvider`)
- Temperature: `0.2` (baja para consistencia clinica)
- Max tokens: `4096`

### 2. Pagina del Expediente (MODIFICAR)

**Archivo:** `apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx`

**Cambios:**
- Agregar estado: `summary`, `loadingSummary`, `generatingSummary`, `showSummaryModal`
- En `useEffect`: fetch GET `/api/.../summary` al cargar
- En columna derecha (despues de "Informacion Rapida"): nueva card "Resumen Paciente"
- Card muestra preview del resumen o estado vacio con boton "Generar"
- Click en card → abre modal
- Boton "Regenerar" → POST al endpoint

### 3. Modal de Resumen (NUEVO componente)

**Archivo:** `apps/doctor/src/components/medical-records/PatientSummaryModal.tsx`

**Props:** `{ isOpen, onClose, summary, onRegenerate, isRegenerating }`

**Contenido:**
- Header: "Resumen Clinico" + nombre del paciente
- Fecha de generacion (prominente): "Generado el 29 may 2026, 14:32"
- Cuerpo: resumen renderizado (el LLM usa **bold**, listas, headers con ##)
- Footer con metadata: cuantos encounters/prescriptions/notes se analizaron
- Boton "Copiar al portapapeles"
- Boton "Regenerar Resumen"
- Boton "Cerrar"

---

## Flujo del Doctor

1. Doctor abre el expediente del paciente (`/dashboard/medical-records/patients/[id]`)
2. En columna derecha ve la card "Resumen Paciente"
   - **Si no hay resumen:** ve "No hay resumen generado" + boton "Generar Resumen"
   - **Si ya existe:** ve fecha de generacion + preview del contenido
3. Click en "Generar" (o "Regenerar"):
   - Boton muestra spinner + "Generando..." (5-15 segundos)
   - POST al API → LLM genera resumen → se guarda en DB
   - Card se actualiza con el nuevo resumen
4. Click en la card → abre modal con resumen completo
5. En el modal puede: leer, copiar al clipboard, regenerar, o cerrar
6. Si vuelve a abrir el expediente manana, el resumen sigue ahi (persistido en DB)

---

## Consideraciones

### Seguridad
- Solo doctores autenticados pueden ver/generar resumenes de SUS pacientes
- Se registra en `PatientAuditLog` cada generacion
- No se envian datos de contacto, fiscales ni administrativos al LLM

### Limites y Costos
- gpt-4o: ~$2.50/1M input tokens, ~$10/1M output tokens
- Un paciente con 20 consultas: ~3,000-5,000 tokens de input
- Costo estimado por resumen: ~$0.01-0.05 USD
- Solo se regenera cuando el doctor lo pide explicitamente

### Dependencias Existentes (no se agrega nada nuevo al package.json)
- `OpenAIChatProvider` — ya implementado en `apps/doctor/src/lib/ai/providers/openai.ts`
- `requireDoctorAuth` + `logAudit` — ya implementados
- `handleApiError` — ya implementado
- `OPENAI_API_KEY` — ya configurado en env
- `prisma` — ya configurado

---

## Archivos Involucrados

| Archivo | Accion |
|---------|--------|
| `packages/database/prisma/schema.prisma` | MODIFICAR — agregar modelo PatientSummary |
| `packages/database/prisma/migrations/add-patient-summaries.sql` | CREAR — migration SQL |
| `apps/doctor/src/app/api/medical-records/patients/[id]/summary/route.ts` | CREAR — GET + POST |
| `apps/doctor/src/app/dashboard/medical-records/patients/[id]/page.tsx` | MODIFICAR — agregar card + estado |
| `apps/doctor/src/components/medical-records/PatientSummaryModal.tsx` | CREAR — modal |

Total: 3 archivos nuevos, 2 archivos modificados. Cero dependencias nuevas de npm.

## Orden de Ejecucion

1. Agregar modelo `PatientSummary` a `schema.prisma`
2. Crear SQL migration file
3. Ejecutar migration en local (`npx prisma db execute`)
4. Regenerar Prisma client (`pnpm db:generate`)
5. Crear API route (GET + POST)
6. Crear componente `PatientSummaryModal`
7. Modificar pagina del expediente (card + estados + fetch)
8. Probar localmente
9. Ejecutar migration en Railway
10. Deploy
