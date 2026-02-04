# Day Details Widget - Visual Layout

## Widget Positioning

```
┌─────────────────────────────────────┐
│                                     │
│        Dashboard Content            │
│                                     │
│                                     │
│                                     │
│                              ┌────┐ │
│                              │ 📅 │ │ ← DayDetailsWidget (Indigo)
│                              │ 3  │ │   bottom-32 (mobile)
│                              └────┘ │   bottom-24 (desktop)
│                                     │
│                              ┌────┐ │
│                              │ ❓ │ │ ← ChatWidget (Blue)
│                              └────┘ │   bottom-20 (mobile)
│                                     │   bottom-6 (desktop)
└─────────────────────────────────────┘
```

## Modal View

```
┌───────────────────────────────────────────────────────┐
│ ╔═════════════════════════════════════════════════╗   │
│ ║  Detalles del día - Domingo, 2 de Febrero    [X]║   │
│ ╠═════════════════════════════════════════════════╣   │
│ ║                                                 ║   │
│ ║  ┌─ 09:00 - 10:00 ─────────────────────────┐   ║   │
│ ║  │  📋 Pendiente | ALTA                     │   │   │
│ ║  │  Consulta de seguimiento                 │   │   │
│ ║  │  Paciente: Juan Pérez                    │   │   │
│ ║  └──────────────────────────────────────────┘   ║   │
│ ║                                                 ║   │
│ ║  ┌─ 10:00 - 11:00 ─────────────────────────┐   ║   │
│ ║  │  📅 Cita | Reservado                     │   │   │
│ ║  │  1 / 1 reservados                        │   │   │
│ ║  │  👤 María García                         │   │   │
│ ║  │  📧 maria@example.com                    │   │   │
│ ║  │  📞 555-1234                             │   │   │
│ ║  └──────────────────────────────────────────┘   ║   │
│ ║                                                 ║   │
│ ║  ┌─ Sin hora específica ────────────────────┐   ║   │
│ ║  │  📋 Pendiente | MEDIA                    │   │   │
│ ║  │  Revisar resultados de laboratorio       │   │   │
│ ║  └──────────────────────────────────────────┘   ║   │
│ ║                                                 ║   │
│ ╚═════════════════════════════════════════════════╝   │
└───────────────────────────────────────────────────────┘
```

## Color Scheme

### Widgets
- **DayDetailsWidget**: `bg-indigo-600` (Purple-ish blue)
- **ChatWidget**: `bg-blue-600` (Blue)

### Badge
- **Count Badge**: `bg-red-500` (Red with white text)
- **Error Indicator**: `bg-red-500` (Red pulsing dot)

### Modal Content
- **Timeline Border**: `border-yellow-400` (Yellow)
- **Pendiente Badge**: `bg-purple-100 text-purple-800` (Purple)
- **Cita Badge**: `bg-green-100 text-green-800` (Green)
- **Priority ALTA**: `bg-red-100 text-red-800` (Red)
- **Priority MEDIA**: `bg-yellow-100 text-yellow-800` (Yellow)
- **Priority BAJA**: `bg-green-100 text-green-800` (Green)
- **Conflict Warning**: `border-red-300 bg-red-50` (Red)
- **Appointment Warning**: `border-blue-300 bg-blue-50` (Blue)

## Responsive Behavior

### Mobile (< 640px)
- Widget button: 48px × 48px
- Widget position: 128px from bottom, 16px from right
- Modal: Full width with 16px margins
- Modal height: 90% of viewport

### Desktop (≥ 640px)
- Widget button: 56px × 56px
- Widget position: 96px from bottom, 24px from right
- Modal: Max width 672px (2xl)
- Modal height: Max 90% of viewport

## Z-Index Layers
- Modal backdrop: z-50
- Modal content: z-50 (relative to backdrop)
- Widgets: z-50
- Dashboard content: Default (z-0)

## Interaction Flow

1. User sees indigo calendar button with badge
2. Badge shows "3" (example: 2 tasks + 1 appointment)
3. User clicks button
4. Modal slides in with backdrop
5. User sees today's schedule in timeline format
6. User can:
   - Click task → Navigate to task detail
   - Click close button → Modal closes
   - Click backdrop → Modal closes
7. Modal closes, back to dashboard

## Empty State

When no tasks or appointments exist:

```
┌───────────────────────────────────────────┐
│                                           │
│              ⏰ (gray icon)              │
│                                           │
│   Sin pendientes ni citas programadas    │
│              para hoy                     │
│                                           │
└───────────────────────────────────────────┘
```
