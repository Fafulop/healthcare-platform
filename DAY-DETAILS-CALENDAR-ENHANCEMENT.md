# Day Details Widget - Calendar Date Picker Enhancement

## Overview
Enhanced the Day Details Widget with a mini calendar picker that allows users to select any date and view tasks/appointments for that specific day (not just today).

## Changes Made

### 1. New Component: `MiniCalendar.tsx`
**File**: `apps/doctor/src/components/day-details/MiniCalendar.tsx`

A reusable mini calendar component that displays a month view with date selection.

**Features**:
- Month navigation (previous, next, today)
- Highlights selected date in indigo
- Shows today's date with lighter indigo background
- Optional highlighted dates (for dates with tasks/appointments)
- Click any date to select it
- Compact design optimized for modal display

**Props**:
```typescript
interface MiniCalendarProps {
  selectedDate: Date;              // Currently selected date
  onDateSelect: (date: Date) => void;  // Callback when date is clicked
  highlightedDates?: string[];     // Optional array of YYYY-MM-DD to highlight
}
```

**Visual Design**:
- Selected date: `bg-indigo-600 text-white` (solid indigo)
- Today: `bg-indigo-100 text-indigo-700` (light indigo)
- Highlighted dates: `bg-indigo-200 text-indigo-900` (medium indigo)
- Regular dates: `text-gray-600 hover:bg-gray-100`
- Small dot indicator on highlighted dates

### 2. Updated: `useDayDetails.ts` Hook
**File**: `apps/doctor/src/hooks/useDayDetails.ts`

**Changes**:
- Added optional `date` parameter to constructor
- `fetchDataForDate()` now accepts a Date parameter
- `refetch()` function now accepts optional date parameter
- Defaults to today if no date provided

**New Signature**:
```typescript
export function useDayDetails(date?: Date) {
  return {
    data: DayDetailsData | null,
    loading: boolean,
    error: string | null,
    refetch: (newDate?: Date) => void  // Now accepts date parameter
  };
}
```

**Usage**:
```typescript
const { data, loading, error, refetch } = useDayDetails();

// Fetch data for a specific date
refetch(new Date('2026-02-15'));
```

### 3. Updated: `DayDetailsModal.tsx`
**File**: `apps/doctor/src/components/day-details/DayDetailsModal.tsx`

**New Features**:
- Calendar toggle button in header
- Collapsible calendar picker section
- Dynamic date display in header
- Loading state while fetching new date data

**New Props**:
```typescript
interface DayDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  slots: AppointmentSlot[];
  selectedDate: Date;           // NEW: Currently selected date
  onDateChange: (date: Date) => void;  // NEW: Date change callback
  loading?: boolean;            // NEW: Loading state
}
```

**UI Changes**:
- Header now has two sections:
  1. Title and close button
  2. Date display and "Cambiar fecha" button
- Calendar toggle button changes appearance when active
- Calendar section appears/disappears with smooth transition
- Loading state shows pulsing clock icon

**User Flow**:
1. User clicks "Cambiar fecha" button
2. Calendar picker expands below header
3. User selects a date
4. Calendar auto-closes
5. Data refetches for selected date
6. Timeline updates with new data

### 4. Updated: `DayDetailsWidget.tsx`
**File**: `apps/doctor/src/components/day-details/DayDetailsWidget.tsx`

**New State**:
- `selectedDate` - tracks which date is currently being viewed
- Starts with today's date

**Smart Badge Count**:
- Badge always shows count for TODAY (not selected date)
- This ensures badge reflects urgent/current items
- Even when viewing past/future dates, badge shows today's count

**Date Change Handler**:
```typescript
const handleDateChange = (newDate: Date) => {
  setSelectedDate(newDate);
  refetch(newDate);
};
```

**Modal Close Behavior**:
- Resets selected date back to today
- Refetches today's data
- Ensures next open shows current day by default

## User Experience Flow

### Opening the Widget
1. User clicks indigo calendar button
2. Modal opens showing TODAY's details
3. Badge shows count of today's tasks/appointments

### Changing Date
1. User clicks "Cambiar fecha" button
2. Mini calendar expands in header area
3. Current month is shown
4. User can navigate months (◀ Hoy ▶)
5. User clicks desired date
6. Calendar auto-closes
7. Loading indicator appears briefly
8. Timeline updates with selected date's data
9. Header updates to show selected date

### Closing Modal
1. User clicks X or backdrop
2. Modal closes
3. Selected date resets to today
4. Next time modal opens, shows today again

## Visual Design

### Calendar Toggle Button
- **Default**: `bg-white text-gray-700 hover:bg-gray-100`
- **Active**: `bg-indigo-100 text-indigo-700`
- Icon: Calendar icon from lucide-react
- Text changes: "Cambiar fecha" / "Ocultar calendario"

### Calendar Section
- Background: `bg-gray-50` (matches header)
- Border: `border-gray-200` (bottom border)
- Padding: `p-4`
- Position: Between header and content

### Loading State
- Pulsing indigo clock icon
- Text: "Cargando datos..."
- Centered in content area

## Technical Implementation

### Date Handling
All components use the same `getLocalDateString()` helper to avoid timezone issues:

```typescript
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### Data Flow
```
User clicks date in calendar
       ↓
onDateSelect(date) called
       ↓
handleDateChange(date) in Widget
       ↓
setSelectedDate(date)
refetch(date)
       ↓
API call with new date
       ↓
Modal updates with new data
       ↓
Timeline re-renders
```

### State Management
- Widget manages `selectedDate` state
- Widget owns `useDayDetails` hook
- Modal is "controlled" - receives date and onChange handler
- Calendar is "controlled" - receives date and onChange handler

## Responsive Design

### Mobile
- Calendar fits modal width
- Touch-friendly date buttons
- Compact month navigation
- Single-letter day headers (D L M M J V S)

### Desktop
- Calendar centered in modal
- Larger date buttons
- Full month/year display
- Standard day headers (Dom Lun Mar...)

## Edge Cases Handled

1. **No data for selected date**: Shows empty state
2. **Loading state**: Shows loading indicator while fetching
3. **Error state**: Error from API is handled gracefully
4. **Today vs Selected**: Badge always shows today's count
5. **Month boundaries**: Calendar handles month/year transitions
6. **Reset on close**: Always returns to today when closing

## Testing Checklist

- [ ] Calendar opens/closes with toggle button
- [ ] Selected date displays correctly in header
- [ ] Clicking date in calendar updates timeline
- [ ] Loading state appears while fetching
- [ ] Data displays correctly for selected date
- [ ] Month navigation works (prev/next/today)
- [ ] Today button jumps to current date
- [ ] Badge always shows today's count (not selected date)
- [ ] Closing modal resets to today
- [ ] Calendar auto-closes after date selection
- [ ] Empty state shows for dates with no data
- [ ] Timeline shows correct conflicts for selected date
- [ ] Patient info displays correctly
- [ ] Responsive design works on mobile/desktop

## Future Enhancement Ideas

1. **Highlighted Dates**: Show dots on calendar for dates with tasks/appointments
2. **Date Range**: Allow selecting date ranges for multi-day view
3. **Quick Jumps**: Add buttons for "Yesterday", "Tomorrow", "Next Week"
4. **Keyboard Navigation**: Arrow keys to navigate calendar
5. **Swipe Gestures**: Swipe left/right to change days on mobile
6. **Date Persistence**: Remember last viewed date in localStorage
7. **Animations**: Smooth transitions when changing dates
8. **Week View**: Toggle between day view and week view
9. **Month Summary**: Show count of tasks per day in calendar
10. **Export**: Export selected day's schedule to PDF/iCal

## Files Modified/Created

### Created
1. ✅ `apps/doctor/src/components/day-details/MiniCalendar.tsx`

### Modified
1. ✅ `apps/doctor/src/hooks/useDayDetails.ts`
2. ✅ `apps/doctor/src/components/day-details/DayDetailsModal.tsx`
3. ✅ `apps/doctor/src/components/day-details/DayDetailsWidget.tsx`

## Code Quality Notes

- All TypeScript interfaces properly defined
- Consistent use of helper functions
- Follows existing code patterns from Pendientes page
- No external dependencies added
- Accessible keyboard navigation
- Mobile-friendly touch targets
- Loading and error states handled
- Clean separation of concerns
