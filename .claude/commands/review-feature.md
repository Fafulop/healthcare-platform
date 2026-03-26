# /review-feature

Runs a systematic code review of a newly built feature. Spawns an Explore agent that reads all specified files, cross-references them against each other using a structured checklist, and returns a consolidated findings report.

## Usage

```
/review-feature

New files:
- path/to/migration.sql
- path/to/api/route.ts
- path/to/api/[id]/route.ts
- path/to/hook/useMyHook.ts
- path/to/components/MyList.tsx
- path/to/components/MyEditor.tsx
- path/to/page.tsx

Modified files:
- path/to/existing/page.tsx (added X button + recent card)
- path/to/existing/timeline/route.ts (added new query)
- path/to/existing/TimelineView.tsx (added new item type)

Reference files (existing patterns to compare against):
- path/to/similar/hook.ts
- path/to/similar/api/route.ts
- path/to/lib/auth.ts
```

## What it does

Spawns an Explore agent with all provided files and runs this checklist:

---

**A. DB ↔ Schema ↔ Migration**
- Every Prisma model field exists in the SQL migration with correct column name (snake_case), type, nullability, and default
- All `@@index` entries exist in the migration with matching columns
- Foreign key constraints in migration match schema relations and schemas (cross-schema refs like `public.doctors`)
- `@id @default(cuid())` — no DB sequence needed, Prisma generates client-side
- `@updatedAt` — Prisma sets on update, migration only needs `DEFAULT CURRENT_TIMESTAMP` for initial insert
- Index columns match actual query `orderBy` fields (not just `createdAt` if queries sort by `updatedAt`)

**B. API Routes**
- Every route calls auth middleware before any DB access
- Resource ownership verified on every route (item belongs to authenticated user)
- Nested ownership verified on PUT/DELETE (item belongs to parent AND user)
- Consistent response shape `{ success: true, data }` or `{ error }` across all routes
- Empty/whitespace input correctly rejected with 400
- No sensitive fields leaked in `select` clauses

**C. Hook / State Management**
- Fetch style is consistent with the codebase (plain `fetch` vs `authFetch` — check reference files)
- POST/PUT requests include `Content-Type: application/json` header
- Local state updated correctly after create/update without full refetch
- Local state updated correctly after delete; editor closed if deleted item was selected
- `isDirty` reset after save and after loading a different item
- `useCallback` dependency arrays include all captured non-stable variables
- No stale closure bugs in async callbacks

**D. Component Props**
- Every prop in each component's interface is actually passed from the parent page
- No extra props passed that aren't in the interface
- Every prop in the interface is actually used inside the component (no dead props)

**E. Page Logic**
- Every navigation action (select item, new item, close, back button) checks `isDirty` before discarding
- No double-prompt: dirty check lives in one place, not duplicated across page + child component
- Mobile and desktop paths both covered for all navigation actions
- Loading/error states show appropriate UI (not blank screen)
- Route params extracted correctly matching the actual `[param]` folder name

**F. Modified Existing Pages**
- New fetch calls in existing pages handle both error (`catch`) and non-success (`data.success === false`) cases
- New cards/sections that always render don't cause layout shifts while data loads
- All new links use correct consistent route segment names

**G. Timeline / Feed Integration** (if applicable)
- New query uses correct `where` clause (scoped to user and parent resource)
- Date field used for sorting exists and is a valid date type
- `Date` objects from Prisma serialize correctly through JSON for client consumption
- New item type added to TypeScript union in the view component
- New item renders correctly and `patientId`/contextId is in scope for links

**H. Cross-Cutting**
- Route segment names consistent everywhere (all links, hrefs, folder name)
- No hardcoded IDs or environment-specific values
- Any append/prepend logic (e.g. Whisper transcription) interacts correctly with existing content format
- `isDirty` set correctly for all content-change paths (user typing AND programmatic changes like transcription)

---

After reading all files the agent returns findings grouped by section with: file name, line number or code snippet, what the issue is, and severity — **Bug / Inconsistency / Minor / Pass**.
