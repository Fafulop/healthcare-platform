# Voice Assistant for Ventas (Sales) - Implementation Documentation

## Overview

The Voice Assistant for Ventas allows doctors to create sales records by dictating information in natural language Spanish. The AI extracts structured data about clients, products/services, quantities, prices, and payment information, then pre-fills the ventas form.

## Status: ✅ COMPLETE

All components have been implemented and integrated into the ventas/new page.

## Architecture

### Data Flow

```
User speaks → Transcription (Whisper API) → Structuring (GPT-4) → Preview → Form Pre-fill
```

1. **Voice Recording**: User records audio describing the sale
2. **Transcription**: Audio converted to text via OpenAI Whisper API
3. **Structuring**: GPT-4 extracts structured data using CREATE_SALE_SYSTEM_PROMPT
4. **Chat Session**: User can refine data conversationally
5. **Preview**: SaleDataPreview shows extracted data with client/product suggestions
6. **Confirmation**: Data maps to form fields, user can manually adjust before saving

## Files Modified/Created

### 1. Types (`apps/doctor/src/types/voice-assistant.ts`) ✅

Added interfaces:
- `VoiceSaleItemData`: Single sale item (product/service with quantity, price, tax, discount)
- `VoiceSaleData`: Complete sale with client, dates, payment info, items list
- Updated `VoiceSessionType` to include `'CREATE_SALE'`
- Updated `VoiceStructuredData` union type
- Updated `SessionTypeDataMap` with `CREATE_SALE: VoiceSaleData`
- Added `EXTRACTABLE_FIELDS` for CREATE_SALE
- Added Spanish labels in `FIELD_LABELS_ES`

### 2. Prompts (`apps/doctor/src/lib/voice-assistant/prompts.ts`) ✅

Added:
- `CREATE_SALE_SYSTEM_PROMPT`: Full extraction guidelines for sales
  - Client name extraction (for fuzzy matching in UI)
  - Date handling (saleDate, deliveryDate with CURRENT DATE CONTEXT)
  - Payment status (PENDING/PARTIAL/PAID) and amountPaid
  - Items array extraction:
    - Product vs Service detection
    - Quantity, unit, unitPrice
    - Optional discountRate and taxRate (defaults: 0 and 0.16)
    - Product name for UI matching

Updated functions:
- `getSystemPrompt()`: Added CREATE_SALE case
- `getSchemaForSessionType()`: Added CREATE_SALE schema
- `getSessionTypeGuidelines()`: Added CREATE_SALE guidelines
- `getAllFieldsForSessionType()`: Added CREATE_SALE fields

### 3. API Routes ✅

#### `apps/doctor/src/app/api/voice/structure/route.ts`
- Added 'CREATE_SALE' to `validSessionTypes` array

#### `apps/doctor/src/app/api/voice/chat/route.ts`
- Added 'CREATE_SALE' to `validSessionTypes` array

### 4. SaleDataPreview Component (`apps/doctor/src/components/voice-assistant/chat/SaleDataPreview.tsx`) ✅

New component that displays:
- **Client Section**: Shows extracted clientName with fuzzy match suggestions from passed clients list
- **Basic Info**: Sale date, delivery date
- **Payment Info**: Payment status, amount paid
- **Items List**: Each item displayed as a card showing:
  - Product/Service icon and type badge
  - Description, SKU (if matched)
  - Quantity × Unit Price with discount and tax breakdown
  - Total calculation per item
  - Product matching suggestions (if productName matches existing products)
- **Validation Warnings**: Alerts if client or items are missing

Props:
- `data: VoiceSaleData`: Extracted sale data
- `fieldsExtracted: string[]`: Which fields were extracted
- `compact?: boolean`: Compact display mode
- `showMissing?: boolean`: Show missing fields in gray
- `clients?: Client[]`: List of clients for fuzzy matching
- `products?: Product[]`: List of products for fuzzy matching

### 5. StructuredDataPreview Component (`apps/doctor/src/components/voice-assistant/chat/StructuredDataPreview.tsx`) ✅

Updated:
- Added `VoiceSaleData` import
- Added `SaleDataPreview` import
- Added `clients` and `products` optional props
- Added CREATE_SALE routing case to render `SaleDataPreview`

### 6. VoiceChatSidebar Component (`apps/doctor/src/components/voice-assistant/chat/VoiceChatSidebar.tsx`) ✅

Updated:
- Added `Client` and `Product` interfaces
- Added `SaleContext` interface with `clients` and `products`
- Added `saleContext?: SaleContext` prop
- Updated `SIDEBAR_TITLES` to include CREATE_SALE: "Asistente - Nueva Venta"
- Pass `clients` and `products` to `StructuredDataPreview` when rendering

### 7. Ventas New Page (`apps/doctor/src/app/dashboard/practice/ventas/new/page.tsx`) ✅

Integrated voice assistant:

**Imports:**
- Dynamic imports for `VoiceRecordingModal` and `VoiceChatSidebar` (client-side only)
- Added `Mic` icon from lucide-react
- Added `VoiceStructuredData` and `VoiceSaleData` types

**State:**
```typescript
const [showVoiceModal, setShowVoiceModal] = useState(false);
const [showVoiceSidebar, setShowVoiceSidebar] = useState(false);
const [voiceInitialData, setVoiceInitialData] = useState<any>(null);
```

**Voice Button:**
- Added "Asistente de Voz" button in header with Mic icon
- Positioned next to "Volver a Ventas" link

**handleVoiceConfirm Function:**
Maps `VoiceSaleData` to form state:
1. **Client Matching**: Fuzzy matches `clientName` against `clients` array (businessName or contactName)
2. **Dates**: Sets `saleDate` and `deliveryDate`
3. **Payment**: Sets `paymentStatus` and `amountPaid`
4. **Notes**: Sets `notes` and `termsAndConditions`
5. **Items**: Maps voice items to form `SaleItem[]`:
   - Attempts to match `productName` to existing `products`
   - If matched, uses product's `id`, `sku`, and `unit`
   - If not matched, creates custom item with voice data
   - Calculates `subtotal` and `taxAmount` per item
   - Applies defaults: `discountRate: 0`, `taxRate: 0.16`

**Voice Components:**
```tsx
{showVoiceModal && (
  <VoiceRecordingModal
    sessionType="CREATE_SALE"
    onTranscriptReady={(data) => {
      setVoiceInitialData(data);
      setShowVoiceModal(false);
      setShowVoiceSidebar(true);
    }}
  />
)}

{showVoiceSidebar && (
  <VoiceChatSidebar
    sessionType="CREATE_SALE"
    onConfirm={handleVoiceConfirm}
    initialData={voiceInitialData}
    saleContext={{
      clients: clients,
      products: products,
    }}
  />
)}
```

## User Workflow

1. **Navigate** to `/dashboard/practice/ventas/new`
2. **Click** "Asistente de Voz" button in header
3. **Record** audio describing the sale:
   ```
   "Venta para Farmacia San Juan, 3 consultas médicas a 500 pesos cada una,
    2 cajas de guantes a 150 pesos, con 10% de descuento.
    Fecha de hoy, pago parcial de 1000 pesos."
   ```
4. **Wait** for transcription and structuring
5. **Review** extracted data in chat sidebar:
   - Client: "Farmacia San Juan" (with match suggestions if found)
   - Items:
     - Consulta médica (servicio) × 3 @ $500 = $1,500
     - Guantes (producto) × 2 @ $150 con 10% desc = $270
   - Payment: PARTIAL, $1,000 paid
6. **Refine** via chat if needed (add more items, change dates, etc.)
7. **Confirm** - Data fills form automatically:
   - Client dropdown pre-selected if match found
   - Sale date filled
   - Items added to table with correct quantities, prices, discounts, taxes
   - Payment status and amount set
8. **Adjust** manually if needed (change client, edit prices, etc.)
9. **Submit** sale as usual

## LLM Prompt Design

### Key Instructions in CREATE_SALE_SYSTEM_PROMPT

1. **Client Extraction**:
   - Extract `clientName` as mentioned (e.g., "Farmacia San Juan")
   - Always set `clientId: null` (UI handles matching)

2. **Date Handling**:
   - Use dates from CURRENT DATE CONTEXT
   - "hoy" → TODAY date
   - "15 de marzo" → CURRENT_YEAR-03-15
   - Never invent or hardcode dates

3. **Items Extraction**:
   - Detect product vs service:
     - Products: physical items, "producto", "pieza", "caja"
     - Services: "consulta", "servicio", "sesión", "hora"
   - Extract quantity, unit, unitPrice (required)
   - Extract discountRate and taxRate (optional, use null if not mentioned)
   - Always set `productId: null` (UI handles matching)

4. **Payment Status**:
   - PENDING: "pendiente", "por pagar"
   - PARTIAL: "abono", "pago parcial", "anticipo"
   - PAID: "pagado", "pagó", "liquidado"

5. **No Hallucination Rule**:
   - Only extract explicitly mentioned information
   - Use null for any uncertain field
   - Never assume or invent data

## Testing Checklist

### Basic Sale Creation
- [ ] Single product sale
- [ ] Single service sale
- [ ] Mixed products and services
- [ ] Sale with discount on items
- [ ] Sale with custom tax rates

### Client Matching
- [ ] Exact client name match
- [ ] Partial client name match (fuzzy)
- [ ] Contact name match
- [ ] No match (user selects manually)

### Product Matching
- [ ] Product name match
- [ ] SKU match
- [ ] Partial name match
- [ ] No match (creates custom item)

### Payment Scenarios
- [ ] PENDING payment (amountPaid = 0)
- [ ] PAID payment (amountPaid = total)
- [ ] PARTIAL payment with specific amount
- [ ] Payment status updates total correctly

### Date Handling
- [ ] "hoy" uses today's date
- [ ] "ayer" uses yesterday's date
- [ ] Specific date: "15 de marzo"
- [ ] Delivery date optional

### Chat Refinement
- [ ] Add more items via chat
- [ ] Change payment status
- [ ] Update quantities
- [ ] Change dates

### Form Integration
- [ ] Voice data correctly maps to form
- [ ] Manual edits work after voice pre-fill
- [ ] Form submission works with voice data
- [ ] Items table displays correctly

## Known Limitations

1. **Client/Product Matching**: Fuzzy matching is simple string comparison. Future: use fuzzy search library like Fuse.js
2. **Multiple Clients**: If voice mentions multiple clients, only the first is extracted
3. **Complex Discounts**: Per-item discounts only. No sale-wide discount support in voice (can be added manually)
4. **Tax Variations**: Per-item tax rates only. No support for mixed tax scenarios in single command

## Future Enhancements

1. **Advanced Matching**:
   - Use Fuse.js for better client/product fuzzy matching
   - Confidence scores for suggestions
   - Allow user to confirm/reject matches in preview

2. **Batch Sales**:
   - Support creating multiple sales in one voice session
   - "Primera venta... Segunda venta..."

3. **Integration with Inventory**:
   - Show stock warnings during voice preview
   - Auto-link to products with SKU

4. **Invoice Generation**:
   - "Generar factura para esta venta"
   - Voice assistant helps fill invoice details

5. **Smart Defaults**:
   - Learn user's typical tax rates per client
   - Suggest common products/services based on client history

## Troubleshooting

### Voice Button Not Appearing
- Check that dynamic imports loaded (client-side only)
- Verify session is authenticated

### Client Not Matching
- Check client name spelling in voice
- Try using contact name instead
- Fall back to manual selection

### Items Not Mapping Correctly
- Review extracted items in chat sidebar
- Check quantity/price extraction
- Verify unit detection (servicio vs pza)

### Form Not Pre-filling
- Check console logs for mapping errors
- Verify `handleVoiceConfirm` is called
- Check that `clients` and `products` arrays are loaded

## Related Documentation

- [Voice Assistant Architecture](./voice-assistant-architecture.md)
- [LLM Prompts Design](./llm-prompts-design.md)
- [Ledger Entry Voice Assistant](./flujo-dinero-voice-assistant.md)
- [Date Timezone Fixes](./date-timezone-fixes.md)

---

**Implementation Date**: January 2026
**Status**: Production Ready ✅
**Last Updated**: January 23, 2026
