# Visual Form Builder Implementation Handoff

## Current Task
Implementing a **Visual Form Builder** to replace JSON editing for custom encounter templates in the doctor dashboard. This is Phase 3 of a larger project.

## What We're Building
A drag-and-drop form builder with:
- Visual field palette (left sidebar)
- Canvas/drop zone (center)
- Configuration panel (right sidebar)
- Live preview mode
- Icon & color pickers
- Mobile responsive design
- No JSON editing fallback (pure visual interface)

## Current Progress
**Status**: Just started - installation phase

**What Happened**:
1. User provided full implementation plan (18-day timeline)
2. Need to install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
3. Need to create directory: `apps/doctor/src/components/form-builder/hooks`
4. Background task completed: searching for sortable/reorder patterns

## Critical Files to Read First

### 1. Existing Implementation (MUST READ)
```
apps/doctor/src/app/dashboard/medical-records/custom-templates/new/page.tsx
apps/doctor/src/app/dashboard/medical-records/custom-templates/[id]/edit/page.tsx
```
These currently have JSON textarea editors that need to be replaced with FormBuilder

### 2. Type Definitions (MUST READ)
```
apps/doctor/src/types/custom-encounter.ts
```
Contains FieldDefinition, FieldType, CustomEncounterTemplate types

### 3. Field Rendering (MUST READ)
```
apps/doctor/src/components/medical-records/DynamicFieldRenderer.tsx
```
This renders fields in preview mode - understand how each field type works

### 4. Reference Components
```
apps/doctor/src/components/medical-records/TemplateSelector.tsx
```
Contains ICON_COMPONENTS map needed for icon picker

### 5. API Endpoints (READ)
```
apps/doctor/src/app/api/custom-templates/route.ts
apps/doctor/src/app/api/custom-templates/[id]/route.ts
```
Understand POST/PUT/GET structure for saving templates

### 6. Background Task Output (READ)
```
C:\Users\52331\AppData\Local\Temp\claude\C--Users-52331-docs-front\tasks\b6d74ea.output
```
Contains search results for existing sortable patterns in the codebase

## Key Decisions Already Made
1. **No JSON mode**: Pure visual builder only
2. **State management**: useReducer + Context (no Redux)
3. **Drag library**: @dnd-kit/core (modern, TypeScript-first)
4. **Icon picker**: Reuse ICON_COMPONENTS from TemplateSelector
5. **Color picker**: 8 preset Tailwind colors
6. **Responsive**: Desktop (3-column), Mobile (stacked with drawers)
7. **Validation**: Real-time with 300ms debounce

## Component Architecture

### Files to Create
```
apps/doctor/src/components/form-builder/
├── FormBuilder.tsx                  # Main orchestrator
├── FormBuilderProvider.tsx          # Context + state management
├── Toolbar.tsx                      # Top bar: metadata, mode toggle, save
├── FieldPalette.tsx                 # Left: draggable field types
├── Canvas.tsx                       # Center: drop zone + field list
├── CanvasField.tsx                  # Individual field card
├── ConfigPanel.tsx                  # Right: field property editor
├── PreviewMode.tsx                  # Live preview using DynamicFieldRenderer
├── SectionManager.tsx               # Section creation modal
├── IconPicker.tsx                   # Icon dropdown selector
├── ColorPicker.tsx                  # Color palette selector
├── FieldTypeIcon.tsx                # Icon mapper for field types
├── ValidationDisplay.tsx            # Error messages display
└── hooks/
    ├── useFormBuilderState.ts       # useReducer + actions
    └── useFieldValidation.ts        # Real-time validation
```

## State Structure (Important!)

```typescript
interface FormBuilderState {
  metadata: {
    name: string;
    description: string;
    icon?: string;
    color?: string;
  };
  fields: FieldDefinition[];
  selectedFieldId: string | null;
  mode: 'edit' | 'preview';
  validationErrors: Record<string, string[]>;
}

type Action =
  | { type: 'SET_METADATA'; payload: Partial<Metadata> }
  | { type: 'ADD_FIELD'; payload: { fieldType: FieldType; insertIndex?: number } }
  | { type: 'UPDATE_FIELD'; payload: { id: string; updates: Partial<FieldDefinition> } }
  | { type: 'REMOVE_FIELD'; payload: string }
  | { type: 'REORDER_FIELD'; payload: { fieldId: string; newIndex: number } }
  | { type: 'SELECT_FIELD'; payload: string | null }
  | { type: 'SET_MODE'; payload: 'edit' | 'preview' }
  | { type: 'VALIDATE' };
```

## Implementation Order (Start Here!)

### Phase 1: Setup (Start Fresh)
1. Read all files listed above to understand context
2. Check if @dnd-kit is already installed: `npm list @dnd-kit/core`
3. If not installed, install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
4. Create directory: `mkdir -p apps/doctor/src/components/form-builder/hooks`
5. Create `useFormBuilderState.ts` hook first (foundation for everything)
6. Create `FormBuilderProvider.tsx` with context

### Phase 2: Basic Layout
7. Create `FormBuilder.tsx` with 3-column desktop layout
8. Create `Toolbar.tsx` with name/description inputs
9. Create `FieldPalette.tsx` with static list of 8 field types
10. Create `Canvas.tsx` with empty state

### Phase 3: Core Features
11. Implement drag-drop in Canvas using @dnd-kit
12. Create `CanvasField.tsx` for field cards
13. Create `ConfigPanel.tsx` for editing field properties
14. Add `PreviewMode.tsx` using DynamicFieldRenderer

### Then Continue Per Plan
Follow the 18-day plan provided in the original requirements

## Field Types to Support
```typescript
const FIELD_TYPES = [
  'text',      // → Type icon
  'textarea',  // → AlignLeft icon
  'number',    // → Hash icon
  'date',      // → Calendar icon
  'time',      // → Clock icon
  'dropdown',  // → ChevronDown icon
  'radio',     // → Circle icon
  'checkbox',  // → CheckSquare icon
  'file'       // → Upload icon
];
```

## Layout Design Reference

### Desktop (>1024px)
```
┌──────────────────────────────────────────────────────────────────┐
│ TOOLBAR                                                           │
│ [Name Input] [Description] [Icon▾] [Color] | [Edit|Preview] [Save]│
├──────────┬─────────────────────────────────┬─────────────────────┤
│          │                                 │                     │
│ PALETTE  │           CANVAS                │   CONFIG PANEL      │
│ (240px)  │           (flex-1)              │   (360px)           │
│          │                                 │                     │
│ Text     │ ┌─ Section: Basic Info ───────┐│ Field Properties    │
│ Textarea │ │ ┌─────────────────────────┐ ││ Label: _________    │
│ Number   │ │ │ Chief Complaint      ⋮  │ ││ Label (ES): _____   │
│ Date     │ │ │ Required • Textarea     │ ││ Type: Textarea      │
│ Time     │ │ └─────────────────────────┘ ││ Required: [✓]       │
│ Dropdown │ │ ┌─────────────────────────┐ ││ Section: [Basic ▾]  │
│ Radio    │ │ │ Lesion Type          ⋮  │ ││ Width: ○Full        │
│ Checkbox │ │ │ Required • Dropdown     │ ││        ○Half        │
│ File     │ │ └─────────────────────────┘ ││        ○Third       │
│          │ └─────────────────────────────┘│ Placeholder: ____   │
│          │ + Add Section                  │ [Delete Field]      │
└──────────┴─────────────────────────────────┴─────────────────────┘
```

### Mobile (<768px)
```
┌────────────────────────┐
│ TOOLBAR (collapsed)    │
│ [Name] [☰ Menu]       │
├────────────────────────┤
│                        │
│    CANVAS (full)       │
│                        │
│  [Tap field to edit]   │
│                        │
├────────────────────────┤
│ [+ Add Field] [Preview]│
└────────────────────────┘
```

## Validation Rules

### Field-level Validation
- Field name: camelCase, unique, non-empty
- Labels: non-empty (both English and Spanish)
- Dropdown/Radio: at least 1 option
- Number: min < max (if both set)

### Template-level Validation
- Template name: non-empty
- At least 1 field required

### Error Messages
- "Field name is required"
- "Field name must be camelCase (e.g., chiefComplaint)"
- "Field name must be unique"
- "Label is required"
- "Spanish label is required"
- "At least one option is required for dropdown fields"
- "Min value must be less than max value"
- "Template name is required"

## Common Pitfalls to Avoid
1. **Don't create files without reading existing ones first** - understand the current structure
2. **Check for existing sortable patterns** - read the background task output
3. **Preserve existing FieldDefinition type** - don't break compatibility
4. **Use DynamicFieldRenderer as-is** - don't modify it
5. **Mobile-first approach** - design for mobile, enhance for desktop
6. **Auto-save in config panel** - debounce 300ms
7. **Preserve state when switching modes** - Edit ↔ Preview

## Questions to Resolve Next Session
1. Are there existing drag-drop patterns in the codebase? (check background task output)
2. Is @dnd-kit already installed?
3. Does the project use Headless UI already? (for dropdowns)
4. What's the current approach to modals? (for mobile config panel)

## Next Immediate Actions (Priority Order)
1. ✅ Read background task output file
2. ✅ Read the 5 critical files listed above
3. ✅ Check package.json for existing dependencies
4. ⬜ Install @dnd-kit dependencies
5. ⬜ Create form-builder directory structure
6. ⬜ Implement useFormBuilderState.ts hook
7. ⬜ Create FormBuilderProvider.tsx
8. ⬜ Build FormBuilder.tsx main component

## Files to Modify (Integration Phase)
1. **apps/doctor/src/app/dashboard/medical-records/custom-templates/new/page.tsx**
   - Replace JSON editor with `<FormBuilder initialTemplate={null} />`
   - Handle save callback

2. **apps/doctor/src/app/dashboard/medical-records/custom-templates/[id]/edit/page.tsx**
   - Replace JSON editor with `<FormBuilder initialTemplate={template} />`
   - Load template data first

## Success Metrics
- ✅ Template creation time: 15 min → 5 min
- ✅ No JSON knowledge required
- ✅ 60fps drag operations
- ✅ WCAG 2.1 Level AA compliance
- ✅ Works on mobile and desktop
- ✅ All 8 field types supported

## Timeline: 18 Days Total
- Days 1-2: Foundation
- Days 3-4: Toolbar & Palette
- Days 5-7: Canvas & Drag-Drop
- Days 8-9: Config Panel
- Days 10-11: Validation
- Day 12: Preview Mode
- Days 13-14: Integration
- Days 15-16: Responsive & Mobile
- Days 17-18: Polish & Testing

---

**Full implementation plan with detailed specs is in the original user message - refer to that for complete architecture details, all component specs, and testing requirements.**
