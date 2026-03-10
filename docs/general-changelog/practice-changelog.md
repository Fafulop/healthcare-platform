# Practice Management — Changelog

## What is the Practice section?

The **Practice Management** module lives at `apps/doctor/src/app/dashboard/practice/`. It is the doctor's business operations workspace with four main sub-sections:

- **Flujo de Dinero** (`/flujo-de-dinero`) — income/expense ledger with Estado de Resultados (P&L), batch actions, inline editing of area, forma de pago, and amount paid. File attachments via UploadThing.
- **Ventas** (`/ventas`) — sales management with full CRUD, status/payment tracking, jsPDF export, voice assistant pre-fill.
- **Compras** (`/compras`) — purchase management, mirrors Ventas structure with supplier linking.
- **Cotizaciones** (`/cotizaciones`) — quotations with patient/client resolver, convert-to-sale action, draft/sent/approved states.
- **Products** (`/products`) — product & service catalog with bill-of-materials (component-based cost calculation), margin display.
- **Proveedores** (`/proveedores`) — supplier directory with CRUD.
- **Áreas** (`/areas`) — cost center tree (INGRESO/EGRESO areas + subareas) for ledger categorization.
- **Datos Maestros** (`/master-data`) — attribute categories and values used as product components.

All API calls use `authFetch` from `@/lib/auth-fetch` targeting `apps/api` at `NEXT_PUBLIC_API_URL`.

Ventas, Compras, Cotizaciones, and Flujo de Dinero list pages have been previously refactored (hooks extracted into `_components/`, `alert()`/`confirm()` replaced). Products, Proveedores, Áreas, and Datos Maestros are unrefactored single-page components.

---

## Bug Audit & Fixes — Date: 2026-03-10

### Bug 1 — `'${API_URL}'` literal fallback in 8 files
**Files:**
- `products/page.tsx`
- `products/new/page.tsx`
- `products/[id]/edit/page.tsx`
- `proveedores/page.tsx`
- `proveedores/new/page.tsx`
- `proveedores/[id]/edit/page.tsx`
- `areas/page.tsx`
- `master-data/page.tsx`

All declared:
```ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';
```
The fallback `'${API_URL}'` is a literal string — an un-interpolated template literal copied from a scaffold. When `NEXT_PUBLIC_API_URL` is not set, every API call resolves to the string `"${API_URL}/api/..."` — a broken URL that always 404s. The same bug was fixed in the `reportes` section (commit `2296939f`).

- **Fix:** Changed fallback to `''` in all 8 files.

---

### Bug 2 — Dead `doctorProfile` state, interface, and fetch in 7 files
**Files:**
- `products/new/page.tsx`
- `products/[id]/edit/page.tsx`
- `proveedores/page.tsx`
- `proveedores/new/page.tsx`
- `compras/new/page.tsx`
- `compras/[id]/edit/page.tsx`
- `areas/page.tsx`
- `master-data/page.tsx`

Every unrefactored page had a copy-pasted `DoctorProfile` interface, `doctorProfile` state, and `fetchDoctorProfile` function that fetches `/api/doctors` using native `fetch()` (no auth token) then stores the result. The stored profile was never referenced in any JSX output or logic — purely dead allocation on every render.

Note: The refactored list hooks (`useVentasPage`, `useComprasPage`, `useCotizacionesPage`) also have a `fetchDoctorProfile`, but there it is legitimate — it's used to populate the doctor's specialty in the jsPDF export header.

- **Fix:** Removed the local `DoctorProfile` interface, `const [doctorProfile, setDoctorProfile]` state declaration, `fetchDoctorProfile` function body, and the `useEffect` call that triggered it, from all 8 affected files. Changed `{ data: session, status }` → `{ status }` in `useSession` where `session` was only used for the dead profile fetch (`compras/[id]/edit/page.tsx`, `proveedores/page.tsx`, `proveedores/new/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx`).

---

### Bug 3 — `console.log` debug statements in production
**Files:** `areas/page.tsx`, `compras/new/page.tsx`

**`areas/page.tsx`** had 2 debug logs inside `handleSaveArea`:
```ts
console.log('Saving area with payload:', payload);
// ...after response...
console.log('Area saved successfully:', result);
```

**`compras/new/page.tsx`** had 3 debug logs inside `handleVoiceConfirm` (the voice assistant data handler):
```ts
console.log('[Compras New] Voice data confirmed:', purchaseData);
console.log('[Compras New] Matched supplier:', matchedSupplier.businessName);
console.log('[Compras New] No supplier match found for:', purchaseData.supplierName);
console.log('[Compras New] Mapped items:', mappedItems.length);
```
These leak internal data structures and matched supplier names to the browser console in production.

- **Fix:** Removed all 5 `console.log` calls.

---

### Bug 4 — `fetchAreas`/`fetchAttributes` race condition — page stuck on spinner
**Files:** `areas/page.tsx`, `master-data/page.tsx`

Both pages called their fetch function from `useEffect(() => { ... }, [])` (empty deps, runs on mount), but the fetch function started with:
```ts
const fetchAreas = async () => {
  if (!session?.user?.email) return;  // ← early exit
  ...
  } finally {
    setLoading(false);
  }
};
```
On the initial mount, `session` is `null` (NextAuth hasn't resolved yet client-side). The guard returns early, skipping the `finally` block, so `setLoading(false)` is never called. The `useEffect` with `[]` deps never re-runs. Once `authStatus` becomes `'authenticated'`, the loading condition `status === "loading" || loading` still evaluates `loading` as `true` — the spinner shows permanently and the page never renders its content.

- **Fix:** Replaced the `useEffect(() => { ... }, [])` pattern with `useEffect(() => { if (status === 'authenticated') { fetchX(); } }, [status])`, matching the pattern used in all other sections. Removed the `if (!session?.user?.email) return` guard inside the fetch functions (redundant after the `required: true` + authStatus check).

---

### Bug 5 — Unnecessary `session?.user?.email` guards in event handlers
**Files:** `areas/page.tsx`, `master-data/page.tsx`

After removing the dead profile fetch, `session` was no longer needed. But the pages also had session guards before CRUD operations:
```ts
const handleDeleteArea = async (area: Area) => {
  if (!session?.user?.email) return;  // ← unnecessary
  ...
};
```
`useSession({ required: true })` redirects to `/login` if unauthenticated, so these guards can never be false when the component is rendered. They are dead branches.

- **Fix:** Removed `if (!session?.user?.email) return;` from `handleSaveArea`, `handleSaveSubarea`, `handleDeleteArea`, `handleDeleteSubarea` in `areas/page.tsx`, and from `handleSaveAttribute`, `handleSaveValue`, `handleDeleteAttribute`, `handleDeleteValue` in `master-data/page.tsx`. Kept the `if (!selectedAreaForSubarea) return` and `if (!selectedAttributeForValue) return` guards which are legitimate (they protect against calling the function before a modal target is set).

---

### Bug 6 — English UI strings throughout `products/[id]/edit/page.tsx`
**File:** `products/[id]/edit/page.tsx`

The entire edit page was in English while the rest of the app is in Spanish:
- Page header: "Back to Products", "Edit Product", "Update product information and bill of materials"
- Form labels: "Product Name *", "SKU / Product Code", "Category", "Selling Price", "Unit of Measure", "Stock", "Status", "Description"
- Status options: "Active", "Inactive", "Discontinued"
- BOM section: "Bill of Materials (BOM)", "Select a component...", "per {unit}", "Qty", "Add", "No components. Add components to calculate cost.", "New" badge, "Save" / "Cancel" inline edit buttons, "Edit quantity" / "Remove component" tooltips
- Cost summary: "Cost Summary", "Components", "Total Cost", "Selling Price", "Profit Margin"
- Submit: "Updating...", "Update Product", "Cancel"
- Error state: "Product not found", "Back to Products"

- **Fix:** Translated all strings to Spanish, consistent with `products/new/page.tsx` and the rest of the section.

---

### Bug 7 — English toast messages in products pages
**Files:** `products/new/page.tsx:137`, `products/[id]/edit/page.tsx:195` and `:229`

Both `addComponent` and `saveComponentQuantity` showed:
```ts
toast.error('Quantity must be greater than 0');
```

- **Fix:** Changed to `toast.error('La cantidad debe ser mayor a 0')`.

---

### Inconsistency 8 — English user-visible error strings in 4 files
**Files:** `areas/page.tsx`, `master-data/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx`

Found during the recheck pass. Error messages shown to users inside modals and form error banners were in English while the entire app is in Spanish:

**`areas/page.tsx`:**
```ts
setError('Failed to load areas');           // shown in modal on fetch failure
throw new Error('Failed to save area');     // shown via setError(err.message)
throw new Error('Failed to save subarea');  // same
```

**`master-data/page.tsx`:**
```ts
throw new Error('Failed to fetch attributes');  // shown via setError(err.message)
throw new Error('Failed to save attribute');    // same
throw new Error('Failed to save value');        // same
```

**`products/new/page.tsx`:**
```ts
throw new Error(errorData.error || 'Failed to create product');  // shown via setError(err.message)
```

**`products/[id]/edit/page.tsx`:**
```ts
throw new Error(errorData.error || 'Failed to update product');  // shown via setError(err.message)
```

- **Fix:** Translated all 8 strings to Spanish:
  - `'Failed to load areas'` → `'Error al cargar las áreas'`
  - `'Failed to save area'` → `'Error al guardar el área'`
  - `'Failed to save subarea'` → `'Error al guardar la subárea'`
  - `'Failed to fetch attributes'` → `'Error al cargar los datos maestros'`
  - `'Failed to save attribute'` → `'Error al guardar la categoría'`
  - `'Failed to save value'` → `'Error al guardar el elemento'`
  - `'Failed to create product'` → `'Error al crear el producto'`
  - `'Failed to update product'` → `'Error al actualizar el producto'`

---

## No remaining known issues ✓
