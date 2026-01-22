# Appointments System Documentation

> Complete technical documentation for the appointment scheduling system in the healthcare platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Data Models](#data-models)
5. [Doctor Dashboard](#doctor-dashboard)
6. [Slot Management](#slot-management)
7. [Booking Management](#booking-management)
8. [Public Booking Widget](#public-booking-widget)
9. [API Reference](#api-reference)
10. [Authentication & Authorization](#authentication--authorization)
11. [SMS Notifications](#sms-notifications)
12. [Business Rules](#business-rules)
13. [State Diagrams](#state-diagrams)

---

## Overview

The appointments system allows doctors to:
- Create availability slots (single day or recurring)
- Manage their schedule (block, unblock, delete slots)
- View and manage patient bookings
- Receive notifications for new bookings

Patients can:
- View available slots on doctor's public profile
- Book appointments by filling a simple form
- Receive confirmation via SMS

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND APPS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────┐         ┌─────────────────────────────┐       │
│  │    DOCTOR APP (:3001)       │         │    PUBLIC APP (:3000)       │       │
│  │                             │         │                             │       │
│  │  /appointments              │         │  /doctor/[slug]             │       │
│  │  ├── page.tsx               │         │  └── BookingWidget.tsx      │       │
│  │  └── CreateSlotsModal.tsx   │         │                             │       │
│  │                             │         │                             │       │
│  │  Features:                  │         │  Features:                  │       │
│  │  • Calendar view            │         │  • Calendar picker          │       │
│  │  • List view                │         │  • Slot selection           │       │
│  │  • Bookings table           │         │  • Patient form             │       │
│  │  • Bulk operations          │         │  • Confirmation display     │       │
│  │  • Create slots modal       │         │                             │       │
│  └─────────────────────────────┘         └─────────────────────────────┘       │
│               │                                       │                         │
└───────────────┼───────────────────────────────────────┼─────────────────────────┘
                │                                       │
                │         ┌─────────────────┐           │
                │         │   authFetch()   │           │
                │         │   (JWT token)   │           │
                │         └────────┬────────┘           │
                │                  │                    │
                ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API APP (:4000)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  /api/appointments/                                                             │
│  │                                                                              │
│  ├── slots/                                                                     │
│  │   ├── route.ts          GET (list), POST (create)                           │
│  │   ├── [id]/route.ts     PUT (update), DELETE, PATCH (block/unblock)         │
│  │   └── bulk/route.ts     POST (bulk delete/block/unblock)                    │
│  │                                                                              │
│  └── bookings/                                                                  │
│      ├── route.ts          GET (list), POST (create)                           │
│      └── [id]/route.ts     GET (by id/code), PATCH (status update)             │
│                                                                                 │
│  /api/doctors/[slug]/availability    GET (public availability)                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (Prisma)                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────┐                       │
│  │   AppointmentSlot   │────────▶│      Booking        │                       │
│  │                     │  1:N    │                     │                       │
│  │  • id               │         │  • id               │                       │
│  │  • doctorId ────────┼────┐    │  • slotId           │                       │
│  │  • date             │    │    │  • doctorId         │                       │
│  │  • startTime        │    │    │  • patientName      │                       │
│  │  • endTime          │    │    │  • patientEmail     │                       │
│  │  • duration         │    │    │  • patientPhone     │                       │
│  │  • basePrice        │    │    │  • status           │                       │
│  │  • discount         │    │    │  • confirmationCode │                       │
│  │  • finalPrice       │    │    │  • reviewToken      │                       │
│  │  • status           │    │    └─────────────────────┘                       │
│  │  • currentBookings  │    │                                                   │
│  │  • maxBookings      │    │    ┌─────────────────────┐                       │
│  └─────────────────────┘    └───▶│      Doctor         │                       │
│                                  │                     │                       │
│                                  │  • id               │                       │
│                                  │  • doctorFullName   │                       │
│                                  │  • slug             │                       │
│                                  │  • clinicPhone      │                       │
│                                  └─────────────────────┘                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
apps/
├── doctor/src/app/appointments/
│   ├── page.tsx                    # Main appointments dashboard
│   └── CreateSlotsModal.tsx        # Modal for creating slots
│
├── public/src/components/doctor/
│   └── BookingWidget.tsx           # Public booking calendar widget
│
└── api/src/app/api/appointments/
    ├── slots/
    │   ├── route.ts                # GET & POST for slots
    │   ├── [id]/
    │   │   └── route.ts            # PUT, DELETE, PATCH for single slot
    │   └── bulk/
    │       └── route.ts            # POST for bulk operations
    │
    └── bookings/
        ├── route.ts                # GET & POST for bookings
        └── [id]/
            └── route.ts            # GET & PATCH for single booking
```

---

## Data Models

### AppointmentSlot

Represents a time slot when the doctor is available for appointments.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `doctorId` | String | Foreign key to Doctor |
| `date` | DateTime | Date of the slot (time set to 00:00:00) |
| `startTime` | String | Start time in "HH:MM" format (e.g., "09:00") |
| `endTime` | String | End time in "HH:MM" format (e.g., "10:00") |
| `duration` | Int | Duration in minutes (30 or 60) |
| `basePrice` | Decimal | Original price before discounts |
| `discount` | Decimal? | Discount value (nullable) |
| `discountType` | String? | "PERCENTAGE" or "FIXED" (nullable) |
| `finalPrice` | Decimal | Calculated price after discount |
| `status` | Enum | "AVAILABLE", "BOOKED", or "BLOCKED" |
| `currentBookings` | Int | Number of active bookings (default: 0) |
| `maxBookings` | Int | Maximum allowed bookings (default: 1) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Relationships**:
- `doctor` → Doctor (Many-to-One)
- `bookings` → Booking[] (One-to-Many)

---

### Booking

Represents a patient's reservation for a specific slot.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `slotId` | String | Foreign key to AppointmentSlot |
| `doctorId` | String | Foreign key to Doctor (denormalized for queries) |
| `patientName` | String | Full name of the patient |
| `patientEmail` | String | Email address |
| `patientPhone` | String | Phone number |
| `patientWhatsapp` | String? | WhatsApp number (optional) |
| `notes` | String? | Patient notes/special requests |
| `finalPrice` | Decimal | Price at time of booking |
| `confirmationCode` | String | 8-character unique code (e.g., "AB12CD34") |
| `reviewToken` | String | 64-character hex token for post-visit review |
| `status` | Enum | Booking status (see below) |
| `confirmedAt` | DateTime? | When doctor confirmed |
| `cancelledAt` | DateTime? | When booking was cancelled |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

**Booking Statuses**:
| Status | Description |
|--------|-------------|
| `PENDING` | New booking, awaiting doctor confirmation |
| `CONFIRMED` | Doctor has confirmed the appointment |
| `CANCELLED` | Booking was cancelled (slot freed) |
| `COMPLETED` | Appointment took place successfully |
| `NO_SHOW` | Patient didn't attend |

**Relationships**:
- `slot` → AppointmentSlot (Many-to-One)
- `doctor` → Doctor (Many-to-One)

---

## Doctor Dashboard

### Page: `/appointments` (`page.tsx`)

The main dashboard where doctors manage their appointments.

#### Component State

```typescript
const [slots, setSlots] = useState<AppointmentSlot[]>([]);      // All slots for current month
const [bookings, setBookings] = useState<Booking[]>([]);        // All bookings
const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
const [loading, setLoading] = useState(true);
const [selectedDate, setSelectedDate] = useState<Date>(new Date());
const [showCreateModal, setShowCreateModal] = useState(false);
const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());  // For bulk ops
```

#### Data Fetching

On mount and when `selectedDate` changes:

```typescript
useEffect(() => {
  if (doctorId) {
    fetchDoctorProfile(doctorId);
    fetchSlots();      // GET /api/appointments/slots?doctorId=...&startDate=...&endDate=...
    fetchBookings();   // GET /api/appointments/bookings?doctorId=...
  }
}, [doctorId, selectedDate]);
```

#### View Modes

**1. Calendar View** (`viewMode === "calendar"`)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────┐  ┌─────────────────────┐  │
│  │        CALENDAR GRID            │  │  SLOTS FOR DATE     │  │
│  │                                 │  │                     │  │
│  │  ◄ Anterior   enero 2026  Sig ► │  │  viernes, 15 ene    │  │
│  │                                 │  │                     │  │
│  │  Dom Lun Mar Mié Jue Vie Sáb   │  │  ┌─────────────────┐ │  │
│  │                  1   2   3   4  │  │  │ 09:00 - 10:00   │ │  │
│  │   5   6   7   8   9  10  11    │  │  │ $500 AVAILABLE  │ │  │
│  │  12  13  14 [15] 16  17  18    │  │  │ [Block] [Delete]│ │  │
│  │  19  20  21  22  23  24  25    │  │  └─────────────────┘ │  │
│  │  26  27  28  29  30  31        │  │                     │  │
│  │                                 │  │  ┌─────────────────┐ │  │
│  │  • = Has slots                  │  │  │ 10:00 - 11:00   │ │  │
│  │  [15] = Selected                │  │  │ $450 (-10%)     │ │  │
│  │                                 │  │  │ BOOKED          │ │  │
│  └─────────────────────────────────┘  │  └─────────────────┘ │  │
│                                       └─────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**2. List View** (`viewMode === "list"`)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Todos los Horarios                    [3 seleccionados] [Bloquear] [Eliminar] │
│                                                                                 │
│  ┌───┬────────────┬───────────────┬──────────┬────────┬───────────┬──────────┐ │
│  │ ☑ │ Fecha      │ Hora          │ Duración │ Precio │ Estado    │ Reservas │ │
│  ├───┼────────────┼───────────────┼──────────┼────────┼───────────┼──────────┤ │
│  │ ☑ │ 15/01/2026 │ 09:00 - 10:00 │ 60 min   │ $500   │ AVAILABLE │ 0/1      │ │
│  │ ☐ │ 15/01/2026 │ 10:00 - 11:00 │ 60 min   │ $450   │ BOOKED    │ 1/1      │ │
│  │ ☑ │ 15/01/2026 │ 11:00 - 12:00 │ 60 min   │ $500   │ BLOCKED   │ 0/1      │ │
│  │ ☑ │ 16/01/2026 │ 09:00 - 09:30 │ 30 min   │ $300   │ AVAILABLE │ 0/1      │ │
│  └───┴────────────┴───────────────┴──────────┴────────┴───────────┴──────────┘ │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Bookings Table

Always visible at the top of the page:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  👤 Citas Reservadas                                              3 total      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Fecha y Hora        │ Paciente      │ Contacto           │ Estado   │ Precio │ Código    │
│  ────────────────────┼───────────────┼────────────────────┼──────────┼────────┼───────────│
│  15 ene 2026         │ Juan Pérez    │ juan@email.com     │ PENDING  │ $500   │ AB12CD34  │
│  09:00 - 10:00       │               │ +52 33 1234 5678   │          │        │           │
│  ────────────────────┼───────────────┼────────────────────┼──────────┼────────┼───────────│
│  16 ene 2026         │ María García  │ maria@email.com    │ CONFIRMED│ $450   │ XY98ZW76  │
│  10:00 - 11:00       │               │ +52 33 8765 4321   │          │        │           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Actions

**Single Slot Actions**:

| Action | API Call | Conditions |
|--------|----------|------------|
| Block | `PATCH /api/appointments/slots/:id` `{ status: "BLOCKED" }` | Any slot |
| Unblock | `PATCH /api/appointments/slots/:id` `{ status: "AVAILABLE" }` | Blocked slots only |
| Delete | `DELETE /api/appointments/slots/:id` | Only if `currentBookings === 0` |

**Bulk Actions**:

| Action | API Call |
|--------|----------|
| Bulk Block | `POST /api/appointments/slots/bulk` `{ action: "block", slotIds: [...] }` |
| Bulk Unblock | `POST /api/appointments/slots/bulk` `{ action: "unblock", slotIds: [...] }` |
| Bulk Delete | `POST /api/appointments/slots/bulk` `{ action: "delete", slotIds: [...] }` |

---

## Slot Management

### CreateSlotsModal (`CreateSlotsModal.tsx`)

Modal component for creating appointment slots.

#### Component State

```typescript
const [mode, setMode] = useState<"single" | "recurring">("single");

// Single mode
const [singleDate, setSingleDate] = useState("");

// Recurring mode
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri

// Time configuration
const [startTime, setStartTime] = useState("09:00");
const [endTime, setEndTime] = useState("17:00");
const [duration, setDuration] = useState<30 | 60>(60);

// Break configuration
const [hasBreak, setHasBreak] = useState(false);
const [breakStart, setBreakStart] = useState("12:00");
const [breakEnd, setBreakEnd] = useState("13:00");

// Pricing
const [basePrice, setBasePrice] = useState("");
const [hasDiscount, setHasDiscount] = useState(false);
const [discount, setDiscount] = useState("");
const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");

// UI state
const [isSubmitting, setIsSubmitting] = useState(false);
const [previewSlots, setPreviewSlots] = useState<number>(0);
```

#### Creation Modes

**1. Single Day Mode**

Creates slots for one specific date.

```
┌─────────────────────────────────────────┐
│  Modo de Creación                       │
│                                         │
│  [■ Día Único]  [□ Recurrente]          │
│                                         │
│  Seleccionar Fecha *                    │
│  ┌─────────────────────────────────┐    │
│  │  2026-01-15                     │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**2. Recurring Mode**

Creates slots for a date range on selected days of the week.

```
┌─────────────────────────────────────────┐
│  Modo de Creación                       │
│                                         │
│  [□ Día Único]  [■ Recurrente]          │
│                                         │
│  Fecha de Inicio *    Fecha de Fin *    │
│  ┌───────────────┐    ┌───────────────┐ │
│  │  2026-01-15   │    │  2026-03-15   │ │
│  └───────────────┘    └───────────────┘ │
│                                         │
│  Repetir en *                           │
│  [■Lun] [■Mar] [■Mié] [■Jue] [■Vie]     │
│  [□Sáb] [□Dom]                          │
│                                         │
└─────────────────────────────────────────┘
```

#### Time Configuration

```
┌─────────────────────────────────────────────────────────────┐
│  ⏰ Configuración de Horario                                │
│                                                             │
│  Hora de Inicio *         Hora de Fin *                     │
│  ┌───────────────┐        ┌───────────────┐                 │
│  │  09:00        │        │  17:00        │                 │
│  └───────────────┘        └───────────────┘                 │
│                                                             │
│  Duración del Horario *                                     │
│  [□ 30 minutos]  [■ 60 minutos]                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑ Agregar descanso (opcional)                       │    │
│  │                                                     │    │
│  │   Inicio de Descanso    Fin de Descanso             │    │
│  │   ┌───────────────┐     ┌───────────────┐           │    │
│  │   │  12:00        │     │  13:00        │           │    │
│  │   └───────────────┘     └───────────────┘           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Pricing Configuration

```
┌─────────────────────────────────────────────────────────────┐
│  💲 Precios                                                 │
│                                                             │
│  Precio Base (MXN) *                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  500.00                                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑ Agregar descuento (opcional)                      │    │
│  │                                                     │    │
│  │   [■ % Porcentaje]  [□ $ Cantidad Fija]             │    │
│  │                                                     │    │
│  │   Descuento (%)                                     │    │
│  │   ┌───────────────────────────────────┐             │    │
│  │   │  10                               │             │    │
│  │   └───────────────────────────────────┘             │    │
│  │                                                     │    │
│  │   ┌─────────────────────────────────────────────┐   │    │
│  │   │  ✓ Precio Final: $450.00 (10% de descuento) │   │    │
│  │   └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Slot Generation Algorithm

```typescript
function generateTimeSlots(
  startTime: string,      // "09:00"
  endTime: string,        // "17:00"
  duration: number,       // 60
  breakStart?: string,    // "12:00"
  breakEnd?: string       // "13:00"
): Array<{ startTime: string; endTime: string }> {

  const slots = [];

  // Convert to minutes for easier calculation
  const startMinutes = 9 * 60;   // 540
  const endMinutes = 17 * 60;    // 1020
  const breakStartMin = 12 * 60; // 720
  const breakEndMin = 13 * 60;   // 780

  let current = startMinutes;

  while (current + duration <= endMinutes) {
    const slotEnd = current + duration;

    // Skip if slot overlaps with break
    if (breakStart && breakEnd) {
      if (!(slotEnd <= breakStartMin || current >= breakEndMin)) {
        // Overlaps with break - skip to after break
        current = breakEndMin;
        continue;
      }
    }

    slots.push({
      startTime: formatTime(current),   // "09:00"
      endTime: formatTime(slotEnd)      // "10:00"
    });

    current += duration;
  }

  return slots;
}

// Example output for 60-min slots, 09:00-17:00, break 12:00-13:00:
// [
//   { startTime: "09:00", endTime: "10:00" },
//   { startTime: "10:00", endTime: "11:00" },
//   { startTime: "11:00", endTime: "12:00" },
//   // Break: 12:00-13:00 (skipped)
//   { startTime: "13:00", endTime: "14:00" },
//   { startTime: "14:00", endTime: "15:00" },
//   { startTime: "15:00", endTime: "16:00" },
//   { startTime: "16:00", endTime: "17:00" },
// ]
// Total: 7 slots per day
```

#### Preview Calculation

The modal shows a real-time preview of how many slots will be created:

```typescript
useEffect(() => {
  // Calculate slots per day
  const slotsPerDay = calculateSlotsPerDay(startTime, endTime, duration, hasBreak, breakStart, breakEnd);

  if (mode === "single") {
    setPreviewSlots(slotsPerDay);
  } else {
    // Count matching days in date range
    let daysCount = 0;
    for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday=6, Monday=0
      if (daysOfWeek.includes(adjustedDay)) {
        daysCount++;
      }
    }
    setPreviewSlots(slotsPerDay * daysCount);
  }
}, [mode, startDate, endDate, daysOfWeek, startTime, endTime, duration, hasBreak, breakStart, breakEnd]);
```

#### API Payload

```typescript
// Single mode
{
  doctorId: "uuid",
  mode: "single",
  date: "2026-01-15",
  startTime: "09:00",
  endTime: "17:00",
  duration: 60,
  breakStart: "12:00",    // Optional
  breakEnd: "13:00",      // Optional
  basePrice: 500,
  discount: 10,           // Optional
  discountType: "PERCENTAGE"  // Optional
}

// Recurring mode
{
  doctorId: "uuid",
  mode: "recurring",
  startDate: "2026-01-15",
  endDate: "2026-03-15",
  daysOfWeek: [0, 1, 2, 3, 4],  // Mon-Fri (0=Mon, 6=Sun)
  startTime: "09:00",
  endTime: "17:00",
  duration: 60,
  breakStart: "12:00",
  breakEnd: "13:00",
  basePrice: 500,
  discount: 10,
  discountType: "PERCENTAGE"
}
```

---

## Booking Management

### Booking Lifecycle

```
┌──────────┐    Patient     ┌──────────┐    Doctor      ┌───────────┐
│  (none)  │ ───creates───▶ │ PENDING  │ ───confirms──▶ │ CONFIRMED │
└──────────┘                └──────────┘                └───────────┘
                                 │                            │
                                 │                            │
                            Patient or                   Appointment
                            Doctor cancels               happens
                                 │                            │
                                 ▼                            ▼
                            ┌───────────┐              ┌───────────┐
                            │ CANCELLED │              │ COMPLETED │
                            └───────────┘              └───────────┘
                                                             │
                                                        Patient
                                                        no-shows
                                                             │
                                                             ▼
                                                       ┌──────────┐
                                                       │ NO_SHOW  │
                                                       └──────────┘
```

### Booking Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     BOOKING CREATION FLOW                       │
└─────────────────────────────────────────────────────────────────┘

1. Patient selects slot in BookingWidget
                    │
                    ▼
2. Patient fills form (name, email, phone, whatsapp?, notes?)
                    │
                    ▼
3. POST /api/appointments/bookings
   {
     slotId: "...",
     patientName: "Juan Pérez",
     patientEmail: "juan@email.com",
     patientPhone: "+52 33 1234 5678",
     patientWhatsapp: "+52 33 1234 5678",
     notes: "Primera visita"
   }
                    │
                    ▼
4. API validates:
   - Slot exists?
   - Slot not BLOCKED?
   - currentBookings < maxBookings?
                    │
                    ▼
5. Generate confirmation code (8 chars: "AB12CD34")
   Generate review token (64 hex chars)
                    │
                    ▼
6. Transaction:
   a) Create Booking record (status: PENDING)
   b) Update Slot: currentBookings++, status = BOOKED if full
                    │
                    ▼
7. Send SMS notifications (async):
   - To patient: confirmation details
   - To doctor: new booking alert
                    │
                    ▼
8. Return response with confirmationCode
```

### Confirmation Code Generation

```typescript
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code; // e.g., "AB12CD34"
}
```

### Review Token Generation

Used for post-appointment review links.

```typescript
function generateReviewToken(): string {
  return crypto.randomBytes(32).toString('hex');
  // e.g., "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
}
```

---

## Public Booking Widget

### BookingWidget (`BookingWidget.tsx`)

Embeddable component for doctor's public profile page.

#### Props

```typescript
interface BookingWidgetProps {
  doctorSlug: string;      // Doctor's URL slug for API calls
  isModal?: boolean;       // Styling mode (embedded vs modal)
  onDayClick?: (dateStr: string) => void;  // Callback for sidebar mode
  initialDate?: string | null;  // Pre-selected date
}
```

#### Component State

```typescript
const [currentMonth, setCurrentMonth] = useState(new Date());
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [availableDates, setAvailableDates] = useState<string[]>([]);
const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
const [bookingStep, setBookingStep] = useState<"calendar" | "form" | "success">("calendar");
const [isSubmitting, setIsSubmitting] = useState(false);
const [formData, setFormData] = useState({
  patientName: "",
  patientEmail: "",
  patientPhone: "",
  patientWhatsapp: "",
  notes: "",
});
const [confirmationCode, setConfirmationCode] = useState("");
```

#### Booking Steps

**Step 1: Calendar** (`bookingStep === "calendar"`)

```
┌─────────────────────────────────────────┐
│  📅 Reserva tu Cita                     │
│     Selecciona fecha y hora             │
├─────────────────────────────────────────┤
│                                         │
│  ◄        enero 2026        ►           │
│                                         │
│  D   L   M   M   J   V   S              │
│              1   2   3   4              │
│  5   6   7   8   9  10  11              │
│ 12  13  14 [15] 16  17  18              │
│ 19  20  21  22  23  24  25              │
│ 26  27  28  29  30  31                  │
│                                         │
│  ─────────────────────────────────────  │
│  Horarios:                              │
│  ┌─────┐ ┌─────┐ ┌─────┐                │
│  │09:00│ │10:00│ │11:00│                │
│  │$500 │ │$500 │ │$450 │                │
│  │     │ │     │ │-10% │                │
│  └─────┘ └─────┘ └─────┘                │
│                                         │
└─────────────────────────────────────────┘
```

**Step 2: Form** (`bookingStep === "form"`)

```
┌─────────────────────────────────────────┐
│  ◄ Volver al calendario                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Horario seleccionado:           │    │
│  │ viernes, 15 de enero • 09:00    │    │
│  │ $500                            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  👤 Nombre Completo *                   │
│  ┌─────────────────────────────────┐    │
│  │ Juan Pérez                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📧 Correo Electrónico *                │
│  ┌─────────────────────────────────┐    │
│  │ juan@email.com                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📞 Número de Teléfono *                │
│  ┌─────────────────────────────────┐    │
│  │ +52 33 1234 5678                │    │
│  └─────────────────────────────────┘    │
│                                         │
│  💬 WhatsApp (opcional)                 │
│  ┌─────────────────────────────────┐    │
│  │ +52 33 1234 5678                │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📝 Notas (opcional)                    │
│  ┌─────────────────────────────────┐    │
│  │ Primera visita, consulta        │    │
│  │ general...                      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │      Confirmar Reserva          │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

**Step 3: Success** (`bookingStep === "success"`)

```
┌─────────────────────────────────────────┐
│                                         │
│            ✓                            │
│                                         │
│     ¡Reserva Confirmada!                │
│                                         │
│  Tu cita ha sido agendada exitosamente  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Código de Confirmación          │    │
│  │                                 │    │
│  │        AB12CD34                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Detalles de la Cita:            │    │
│  │                                 │    │
│  │ Fecha: viernes, 15 de enero     │    │
│  │        de 2026                  │    │
│  │ Hora: 09:00 - 10:00             │    │
│  │ Duración: 60 minutos            │    │
│  │ Precio: $500                    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Recibirás una confirmación por SMS     │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     Agendar Otra Cita           │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## API Reference

### Slots Endpoints

#### GET `/api/appointments/slots`

Fetch appointment slots with filters.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctorId` | string | Yes | Doctor's UUID |
| `startDate` | ISO string | No | Filter slots from this date |
| `endDate` | ISO string | No | Filter slots until this date |
| `status` | string | No | Filter by status (AVAILABLE, BOOKED, BLOCKED) |

**Response**:
```json
{
  "success": true,
  "count": 7,
  "data": [
    {
      "id": "uuid",
      "doctorId": "uuid",
      "date": "2026-01-15T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "10:00",
      "duration": 60,
      "basePrice": 500,
      "discount": 10,
      "discountType": "PERCENTAGE",
      "finalPrice": 450,
      "status": "AVAILABLE",
      "currentBookings": 0,
      "maxBookings": 1,
      "bookings": []
    }
  ]
}
```

---

#### POST `/api/appointments/slots`

Create appointment slots.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Request Body (Single Mode)**:
```json
{
  "doctorId": "uuid",
  "mode": "single",
  "date": "2026-01-15",
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": 60,
  "breakStart": "12:00",
  "breakEnd": "13:00",
  "basePrice": 500,
  "discount": 10,
  "discountType": "PERCENTAGE"
}
```

**Request Body (Recurring Mode)**:
```json
{
  "doctorId": "uuid",
  "mode": "recurring",
  "startDate": "2026-01-15",
  "endDate": "2026-03-15",
  "daysOfWeek": [0, 1, 2, 3, 4],
  "startTime": "09:00",
  "endTime": "17:00",
  "duration": 60,
  "breakStart": "12:00",
  "breakEnd": "13:00",
  "basePrice": 500,
  "discount": 10,
  "discountType": "PERCENTAGE"
}
```

**Days of Week Mapping**:
| Index | Day |
|-------|-----|
| 0 | Monday |
| 1 | Tuesday |
| 2 | Wednesday |
| 3 | Thursday |
| 4 | Friday |
| 5 | Saturday |
| 6 | Sunday |

**Response**:
```json
{
  "success": true,
  "message": "Created 42 recurring slots",
  "count": 42,
  "totalPossible": 42
}
```

---

#### PUT `/api/appointments/slots/:id`

Update a slot's details.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Request Body**:
```json
{
  "startTime": "10:00",
  "endTime": "11:00",
  "duration": 60,
  "basePrice": 600,
  "discount": 15,
  "discountType": "PERCENTAGE",
  "status": "AVAILABLE"
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* updated slot */ }
}
```

**Error (has bookings)**:
```json
{
  "success": false,
  "error": "Cannot edit slot with active bookings"
}
```

---

#### DELETE `/api/appointments/slots/:id`

Delete a slot.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Response (success)**:
```json
{
  "success": true,
  "message": "Slot deleted successfully"
}
```

**Response (has bookings)**:
```json
{
  "success": false,
  "error": "Cannot delete slot with active bookings. Consider blocking it instead."
}
```

---

#### PATCH `/api/appointments/slots/:id`

Block or unblock a slot.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Request Body**:
```json
{
  "status": "BLOCKED"  // or "AVAILABLE"
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* updated slot */ },
  "message": "Slot blocked successfully"
}
```

---

#### POST `/api/appointments/slots/bulk`

Perform bulk operations on multiple slots.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Request Body**:
```json
{
  "action": "delete",  // "delete", "block", or "unblock"
  "slotIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Deleted 3 slots",
  "count": 3
}
```

---

### Bookings Endpoints

#### GET `/api/appointments/bookings`

Fetch bookings (scoped by authentication).

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `doctorId` | string | No | Filter by doctor (admin only) |
| `patientEmail` | string | No | Filter by patient email |
| `status` | string | No | Filter by status |
| `startDate` | ISO string | No | Filter from date |
| `endDate` | ISO string | No | Filter until date |

**Authorization Scoping**:
- Doctors: Can only see their own bookings (doctorId forced)
- Admins: Can see all bookings, optionally filter by doctorId

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "uuid",
      "slotId": "uuid",
      "doctorId": "uuid",
      "patientName": "Juan Pérez",
      "patientEmail": "juan@email.com",
      "patientPhone": "+52 33 1234 5678",
      "patientWhatsapp": "+52 33 1234 5678",
      "notes": "Primera visita",
      "finalPrice": 500,
      "confirmationCode": "AB12CD34",
      "status": "PENDING",
      "createdAt": "2026-01-10T10:30:00.000Z",
      "slot": {
        "date": "2026-01-15T00:00:00.000Z",
        "startTime": "09:00",
        "endTime": "10:00",
        "duration": 60
      },
      "doctor": {
        "doctorFullName": "Dr. García",
        "primarySpecialty": "Medicina General",
        "clinicAddress": "Av. Principal 123",
        "clinicPhone": "+52 33 9999 8888"
      }
    }
  ]
}
```

---

#### POST `/api/appointments/bookings`

Create a new booking (public endpoint, no auth required).

**Request Body**:
```json
{
  "slotId": "uuid",
  "patientName": "Juan Pérez",
  "patientEmail": "juan@email.com",
  "patientPhone": "+52 33 1234 5678",
  "patientWhatsapp": "+52 33 1234 5678",
  "notes": "Primera visita"
}
```

**Response (success)**:
```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "uuid",
    "confirmationCode": "AB12CD34",
    "status": "PENDING",
    "finalPrice": 500,
    "slot": { /* slot details */ },
    "doctor": { /* doctor details */ }
  }
}
```

**Response (slot blocked)**:
```json
{
  "success": false,
  "error": "This slot is not available for booking"
}
```

**Response (slot full)**:
```json
{
  "success": false,
  "error": "This slot is fully booked"
}
```

---

#### GET `/api/appointments/bookings/:id`

Get booking by ID or confirmation code.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "confirmationCode": "AB12CD34",
    "patientName": "Juan Pérez",
    "status": "CONFIRMED",
    "slot": { /* slot details */ },
    "doctor": { /* doctor details */ }
  }
}
```

---

#### PATCH `/api/appointments/bookings/:id`

Update booking status.

**Headers**:
- `Authorization: Bearer <JWT_TOKEN>` (required)

**Request Body**:
```json
{
  "status": "CONFIRMED"  // PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW
}
```

**Special Handling**:

1. **Cancellation** (`status: "CANCELLED"`):
   - Sets `cancelledAt` timestamp
   - Decrements `slot.currentBookings`
   - Sets `slot.status` back to `AVAILABLE`

2. **Confirmation** (`status: "CONFIRMED"`):
   - Sets `confirmedAt` timestamp

**Response**:
```json
{
  "success": true,
  "data": { /* updated booking */ },
  "message": "Booking confirmed successfully"
}
```

---

## Authentication & Authorization

### Token Validation

All protected endpoints use `validateAuthToken()`:

```typescript
const { email, role, userId, doctorId } = await validateAuthToken(request);
```

### Role-Based Access

| Role | Slots | Bookings |
|------|-------|----------|
| `DOCTOR` | Can only manage own slots | Can only view own bookings |
| `ADMIN` | Can manage any doctor's slots | Can view all bookings |
| (none) | Read-only (public availability) | Can create bookings |

### Doctor Authorization Check

```typescript
if (role === 'DOCTOR') {
  if (!authenticatedDoctorId) {
    return error("Doctor profile not found for this user", 403);
  }
  if (doctorId !== authenticatedDoctorId) {
    return error("Unauthorized - you can only manage your own slots", 403);
  }
}
```

---

## SMS Notifications

### Configuration

SMS is sent via Twilio when configured:

```typescript
if (isSMSConfigured() && bookingWithSlot) {
  // Send to patient
  sendPatientSMS(smsDetails).catch(console.error);

  // Send to doctor
  sendDoctorSMS(smsDetails).catch(console.error);
}
```

### SMS Details Object

```typescript
const smsDetails = {
  patientName: "Juan Pérez",
  patientPhone: "+52 33 1234 5678",
  doctorName: "Dr. García",
  doctorPhone: "+52 33 9999 8888",
  date: "2026-01-15T00:00:00.000Z",
  startTime: "09:00",
  endTime: "10:00",
  duration: 60,
  finalPrice: 500,
  confirmationCode: "AB12CD34",
  clinicAddress: "Av. Principal 123",
  specialty: "Medicina General",
  reviewToken: "a1b2c3d4..."
};
```

### Patient SMS Content

```
¡Tu cita está confirmada!

Doctor: Dr. García
Especialidad: Medicina General
Fecha: 15 de enero de 2026
Hora: 09:00 - 10:00

Código de confirmación: AB12CD34

Dirección: Av. Principal 123
```

### Doctor SMS Content

```
Nueva cita agendada:

Paciente: Juan Pérez
Fecha: 15 de enero de 2026
Hora: 09:00 - 10:00
Teléfono: +52 33 1234 5678
```

---

## Business Rules

### Slot Rules

| Rule | Description |
|------|-------------|
| Duration constraint | Must be 30 or 60 minutes |
| No past dates | Cannot create slots for dates in the past |
| Break handling | Slots overlapping break time are skipped |
| Duplicate prevention | `createMany` with `skipDuplicates: true` |
| Delete protection | Cannot delete slots with active bookings |
| Edit protection | Cannot edit slots with active bookings (except blocking) |

### Booking Rules

| Rule | Description |
|------|-------------|
| Slot availability | Cannot book BLOCKED slots |
| Capacity check | Cannot exceed `maxBookings` |
| Price snapshot | `finalPrice` is captured at booking time |
| Cancellation effect | Frees up slot, decrements `currentBookings` |
| Confirmation code | Unique 8-character alphanumeric |

### Price Calculation

```typescript
function calculateFinalPrice(
  basePrice: number,
  discount: number | null,
  discountType: string | null
): number {
  if (!discount || !discountType) return basePrice;

  if (discountType === 'PERCENTAGE') {
    return basePrice - (basePrice * discount / 100);
  } else if (discountType === 'FIXED') {
    return Math.max(0, basePrice - discount);
  }

  return basePrice;
}

// Examples:
// basePrice: 500, discount: 10, type: PERCENTAGE → 450
// basePrice: 500, discount: 50, type: FIXED → 450
// basePrice: 500, discount: null → 500
```

---

## State Diagrams

### Slot Status Transitions

```
                    ┌────────────────────────────────────────────┐
                    │                                            │
                    ▼                                            │
┌───────────┐   booking    ┌────────┐   cancellation    ┌───────────┐
│ AVAILABLE │ ───────────▶ │ BOOKED │ ────────────────▶ │ AVAILABLE │
└───────────┘              └────────┘                   └───────────┘
      │                                                       ▲
      │ block                                                 │ unblock
      ▼                                                       │
┌───────────┐                                                 │
│  BLOCKED  │ ────────────────────────────────────────────────┘
└───────────┘
```

### Booking Status Transitions

```
┌─────────┐
│ PENDING │
└────┬────┘
     │
     ├──────────────┬───────────────────┐
     │ confirm      │ cancel            │
     ▼              ▼                   │
┌───────────┐  ┌───────────┐            │
│ CONFIRMED │  │ CANCELLED │            │
└─────┬─────┘  └───────────┘            │
      │                                  │
      ├──────────────┬──────────────────┤
      │ complete     │ no-show          │
      ▼              ▼                  │
┌───────────┐  ┌──────────┐             │
│ COMPLETED │  │ NO_SHOW  │             │
└───────────┘  └──────────┘             │
      │                                  │
      │ (can also cancel from CONFIRMED) │
      └──────────────────────────────────┘
                     │
                     ▼
               ┌───────────┐
               │ CANCELLED │
               └───────────┘
```

---

## Summary

The appointments system provides a complete scheduling solution:

1. **Doctors** create availability slots (single or recurring)
2. **Patients** browse available times and book appointments
3. **System** manages slot capacity and booking lifecycle
4. **Notifications** keep both parties informed via SMS

Key technical features:
- JWT-based authentication with role scoping
- Transaction-safe booking creation
- Real-time slot capacity management
- Flexible pricing with discounts
- Bulk operations for efficient management
