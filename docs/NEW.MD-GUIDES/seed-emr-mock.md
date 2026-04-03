# Seed de datos mock para Expediente Médico (EMR)

## ¿Qué hace?

El script `packages/database/prisma/seed-emr.ts` inserta datos de demostración en el expediente médico de un doctor específico. Crea pacientes realistas con historial clínico completo para poder mostrar y probar la plataforma.

### Datos que crea

| Tipo | Cantidad | Descripción |
|------|----------|-------------|
| Pacientes | 8 | Con datos demográficos, alergias, condiciones crónicas, medicamentos actuales |
| Consultas (Encounters) | 18 | Notas SOAP completas, signos vitales, diagnóstico, plan de tratamiento |
| Recetas | 8 | Con medicamentos, dosis, frecuencia e instrucciones |
| Tareas | 10 | Seguimientos, referencias, estudios pendientes |

### Pacientes incluidos

| ID | Nombre | Condición principal |
|----|--------|---------------------|
| P-001 | Carlos Ramírez Jiménez | Diabetes mellitus tipo 2 + Hipertensión |
| P-002 | Laura González Vega | Hipotiroidismo primario |
| P-003 | Miguel Ángel Torres Sánchez | Asma + Rinitis alérgica |
| P-004 | Ana Sofía Mendoza Flores | Sana (chequeo preventivo) |
| P-005 | Roberto Hernández Cruz | Cardiopatía isquémica + DM2 + Dislipidemia |
| P-006 | Valeria López Ramos | Alergia alimentaria (anafilaxia por mariscos) |
| P-007 | Jorge Luis Pérez Morales | EPOC moderado + Hipertensión |
| P-008 | Carmen Ruiz Ortega | Lupus eritematoso sistémico |

---

## Cómo correrlo de nuevo

### Prerrequisitos

- Node.js instalado (`node --version`)
- Railway CLI instalado (`railway --version`)
- Estar logueado en Railway (`railway login`)
- El proyecto `DOCTORES-SEO-PACIENTE-MGMT` vinculado

### Pasos

#### 1. Obtener la URL pública de la base de datos

En Railway → servicio **Postgres** → pestaña **Settings** → sección **Networking**:

- Bajo **Connect over TCP** encontrarás el proxy público con formato:
  ```
  yamanote.proxy.rlwy.net:51502
  ```
- La contraseña está en la variable `POSTGRES_PASSWORD` del servicio Postgres.

La URL completa tiene este formato:
```
postgresql://postgres:<PASSWORD>@<PROXY_HOST>:<PROXY_PORT>/railway
```

#### 2. Verificar que el doctor objetivo existe

El script busca el usuario por email y falla si no existe o no tiene perfil de doctor vinculado. Edita la línea del script si necesitas cambiar el email destino:

```ts
// packages/database/prisma/seed-emr.ts  línea ~207
const user = await prisma.user.findUnique({
  where: { email: 'sismo.sistema1@gmail.com' },  // <-- cambiar aquí
  ...
});
```

#### 3. Ejecutar el script

Desde la raíz del repositorio, en una terminal (Git Bash o similar):

```bash
DATABASE_URL="postgresql://postgres:<PASSWORD>@<PROXY_HOST>:<PROXY_PORT>/railway" \
  node "packages/database/node_modules/tsx/dist/cli.mjs" \
  "packages/database/prisma/seed-emr.ts"
```

Ejemplo con los datos actuales de producción:

```bash
DATABASE_URL="postgresql://postgres:<PASSWORD>@yamanote.proxy.rlwy.net:51502/railway" \
  node "packages/database/node_modules/tsx/dist/cli.mjs" \
  "packages/database/prisma/seed-emr.ts"
```

> **Nota:** El script tiene un guard de idempotencia. Si el doctor ya tiene pacientes, **no inserta duplicados** y termina con un aviso. Para re-seedear, primero hay que borrar los datos existentes desde la app o con Prisma Studio.

#### 4. Verificar resultado esperado

```
🌱 Seeding mock EMR data for sismo.sistema1@gmail.com...

✅ Found doctor: Dr, Prueba (dr-prueba)
  👤 Patient created: Carlos Ramírez Jiménez (P-001)
     📋 3 encounter(s) created
     💊 1 prescription(s) created
  ...

📊 Summary:
   Patients:      8
   Encounters:    18
   Prescriptions: 8
   Tasks:         10
```

---

## Para un doctor diferente

1. Editar el email en la línea `where: { email: '...' }` del script
2. Asegurarse de que ese usuario existe en la base de datos y tiene un doctor vinculado (`doctorId` no nulo en la tabla `users`)
3. Correr el script con el mismo comando

---

## Borrar los datos mock

Para limpiar los datos de un doctor y poder re-seedear:

```bash
# Abrir Prisma Studio apuntando a producción
DATABASE_URL="postgresql://postgres:<PASSWORD>@yamanote.proxy.rlwy.net:51502/railway" \
  node "packages/database/node_modules/.bin/prisma" studio
```

O bien, desde la app del doctor: eliminar pacientes manualmente (esto hace cascade delete de encounters, prescriptions y tareas vinculadas al paciente).

---

## Archivos relevantes

| Archivo | Descripción |
|---------|-------------|
| `packages/database/prisma/seed-emr.ts` | Script principal de seed |
| `packages/database/prisma/schema.prisma` | Schema de los modelos Patient, ClinicalEncounter, Prescription, Task |
| `packages/database/prisma/seed.ts` | Seed original (crea doctores y usuarios, **no tocar**) |
