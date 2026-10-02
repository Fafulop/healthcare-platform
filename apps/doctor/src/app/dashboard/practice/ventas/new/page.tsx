'use client';

import { useSession } from 'next-auth/react';
import { redirect, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import dynamic from 'next/dynamic';
import type { VoiceStructuredData, VoiceSaleData } from '@/types/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import { SaleChatPanel } from '@/components/practice/SaleChatPanel';
import type { SaleFormData, SaleChatItem } from '@/hooks/useSaleChat';
import { useSaleForm } from '../_components/useSaleForm';
import { SaleItemsSection } from '../_components/SaleItemsSection';
import { SaleProductModal } from '../_components/SaleProductModal';
import { SaleCustomItemModal } from '../_components/SaleCustomItemModal';
import { SaleSummaryCard } from '../_components/SaleSummaryCard';
import type { SaleItem } from '../_components/sale-types';
import { usePermissions } from '@/lib/permissions-client';

const VoiceRecordingModal = dynamic(
  () => import('@/components/voice-assistant/VoiceRecordingModal').then(m => m.VoiceRecordingModal),
  { ssr: false }
);
const VoiceChatSidebar = dynamic(
  () => import('@/components/voice-assistant/chat/VoiceChatSidebar').then(m => m.VoiceChatSidebar),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Name + internal id ONLY (GET /ventas/pacientes): the Ventas toggle must not expose the patient's
// contact data — don't widen this to «show the email».
interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
}

export default function NewVentaPage() {
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { redirect('/login'); } });
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useSaleForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patients — VENTAS PACIENTE paso 3: the buyer is ALWAYS a patient, saved as `patientId` on the
  // sale. (Before, picking a patient made a name-matched COPY in `clients`.)
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  // The list failed to load: SAID in the form (an empty select would read «you have no patients»).
  const [patientsError, setPatientsError] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  // Opened from a visita (`?patientId=&visitaId=`): patient fixed, sale filed in that visita.
  const visitaId = searchParams.get('visitaId');
  const patientIdParam = searchParams.get('patientId');
  const desdeVisita = !!visitaId && !!patientIdParam;
  // The visita's cita service (and whether it already has its charge), for the double-charge warning.
  const citaServicio = searchParams.get('citaServicio');
  const citaCobrada = searchParams.get('citaCobrada') === '1';

  // Voice / Chat
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVoiceSidebar, setShowVoiceSidebar] = useState(false);
  const [voiceInitialData, setVoiceInitialData] = useState<any>(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      form.fetchProducts();
      fetchPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  // sale-chat is a legacy AI surface, OWNER_ONLY regardless of the Ventas
  // toggle (00-REQUISITOS §5.3) — found via bug hunt 2026-07-21 (§16
  // hallazgo 3 family).
  // TIERS Q2b: la puerta cuelga de la key de plan `ia` (antes `isOwner`).
  // `can('ia')` ya es false para members, así que owner-only se conserva.
  // `!permsLoading`: mientras la sesión carga, permissions-client hace
  // fail-open (`isOwner ?? true`, `tier ?? PRO`), así que `can('ia')` sería
  // true en esa ventana y la puerta se pintaría ENCENDIDA en un plan sin IA.
  const { can, loading: permsLoading } = usePermissions();
  const aiAllowed = !permsLoading && can('ia');
  useEffect(() => {
    if (searchParams.get('chat') === 'true' && aiAllowed) setChatPanelOpen(true);
  }, [searchParams, aiAllowed]);

  useEffect(() => {
    // Wait for patients and products: applying (and deleting) the dictation before they load — or
    // after the patient list FAILED — matched nobody and lost it for good.
    if (searchParams.get('voice') === 'true' && !loadingPatients && !patientsError && !form.loadingProducts) {
      const stored = sessionStorage.getItem('voiceSaleData');
      if (stored) {
        try { handleVoiceConfirm(JSON.parse(stored).data); sessionStorage.removeItem('voiceSaleData'); }
        catch (e) { console.error('Error parsing voice sale data:', e); }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, patients, loadingPatients, patientsError, form.loadingProducts]);

  // `?patientId=` (from a visita, or a link from the patient) preselects that patient — fetched in
  // the same list with `include`, so an archived one is there too.
  useEffect(() => {
    if (!patientIdParam || patients.length === 0) return;
    const p = patients.find(x => x.id === patientIdParam);
    if (p) setSelectedPatient(p);
  }, [patientIdParam, patients]);

  const fetchPatients = async () => {
    try {
      // Under the `ventas` toggle (not `expedientes`): a helper with only Ventas can still sell.
      const include = patientIdParam ? `?include=${encodeURIComponent(patientIdParam)}` : '';
      const res = await authFetch(`${API_URL}/api/practice-management/ventas/pacientes${include}`);
      if (!res.ok) throw new Error('Error al cargar pacientes');
      const data = await res.json();
      setPatients(data.data || []);
    } catch (err) {
      console.error('Error al cargar pacientes:', err);
      setPatientsError(true);
    }
    finally { setLoadingPatients(false); }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPatient(patients.find(p => p.id === e.target.value) ?? null);
  };

  const handleVoiceModalComplete = (transcript: string, data: VoiceStructuredData, sessionId: string, transcriptId: string, audioDuration: number) => {
    setVoiceInitialData({ transcript, structuredData: data, sessionId, transcriptId, audioDuration });
    setShowVoiceModal(false);
    setShowVoiceSidebar(true);
  };

  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    const saleData = data as VoiceSaleData;
    // From a visita the patient is fixed: dictation can't move the sale to someone else.
    if (saleData.clientName && !desdeVisita) {
      const matchedPatient = patients.find(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(saleData.clientName!.toLowerCase())
      );
      if (matchedPatient) setSelectedPatient(matchedPatient);
    }
    if (saleData.saleDate) form.setSaleDate(saleData.saleDate);
    if (saleData.deliveryDate) form.setDeliveryDate(saleData.deliveryDate);
    if (saleData.paymentStatus) form.setPaymentStatus(saleData.paymentStatus);
    if (saleData.amountPaid != null) form.setAmountPaid(saleData.amountPaid);
    if (saleData.notes) form.setNotes(saleData.notes);
    if (saleData.termsAndConditions) form.setTermsAndConditions(saleData.termsAndConditions);
    if (saleData.items?.length) {
      const mappedItems: SaleItem[] = saleData.items.map((vi, i) => {
        const matched = vi.productName ? form.products.find(p =>
          p.name.toLowerCase().includes(vi.productName!.toLowerCase())
        ) : undefined;
        const quantity = vi.quantity || 1;
        const unitPrice = vi.unitPrice || 0;
        const discountRate = vi.discountRate || 0;
        const taxRate = vi.taxRate ?? 0.16;
        const subtotal = quantity * unitPrice * (1 - discountRate);
        return {
          tempId: `voice-${Date.now()}-${i}`,
          productId: matched?.id || null,
          itemType: vi.itemType,
          description: vi.description,
          sku: matched?.sku || vi.sku || null,
          quantity, unit: vi.unit || (vi.itemType === 'service' ? 'servicio' : 'pza'),
          unitPrice, discountRate, taxRate,
          taxAmount: subtotal * taxRate,
          taxRate2: 0, taxAmount2: 0, subtotal,
        };
      });
      form.setItems(mappedItems);
    }
    setShowVoiceSidebar(false);
  }, [form.products, patients, desdeVisita]);

  const chatFormData: SaleFormData = useMemo(() => ({
    clientName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : '',
    saleDate: form.saleDate,
    deliveryDate: form.deliveryDate,
    paymentStatus: form.paymentStatus,
    amountPaid: form.amountPaid,
    notes: form.notes,
    termsAndConditions: form.termsAndConditions,
    itemCount: form.items.length,
    items: form.items.map(it => ({
      description: it.description, itemType: it.itemType,
      quantity: it.quantity, unit: it.unit, unitPrice: it.unitPrice,
      discountRate: it.discountRate, taxRate: it.taxRate,
    })),
  }), [selectedPatient, form.saleDate, form.deliveryDate,
       form.paymentStatus, form.amountPaid, form.notes, form.termsAndConditions, form.items]);

  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    if (updates.clientName && !desdeVisita) {
      const name = String(updates.clientName).toLowerCase();
      const mp = patients.find(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(name));
      if (mp) setSelectedPatient(mp);
    }
    if (updates.saleDate) form.setSaleDate(updates.saleDate);
    if (updates.deliveryDate) form.setDeliveryDate(updates.deliveryDate);
    if (updates.paymentStatus) form.setPaymentStatus(updates.paymentStatus);
    if (updates.amountPaid !== undefined) form.setAmountPaid(updates.amountPaid);
    if (updates.notes) form.setNotes(updates.notes);
    if (updates.termsAndConditions) form.setTermsAndConditions(updates.termsAndConditions);
  }, [patients, desdeVisita]);

  const handleChatItemActions = useCallback((actions: { type: string; index?: number; item?: Partial<SaleChatItem>; updates?: Partial<SaleChatItem>; items?: Partial<SaleChatItem>[] }[]) => {
    form.setItems(prev => {
      let result = [...prev];
      for (const action of actions) {
        switch (action.type) {
          case 'add': if (action.item) {
            const q = action.item.quantity || 1, p = action.item.unitPrice || 0, d = action.item.discountRate || 0;
            const t = action.item.taxRate ?? 0.16, s = q * p * (1 - d);
            result.push({ tempId: `chat-${Date.now()}-${result.length}`, productId: null, itemType: action.item.itemType || 'service',
              description: action.item.description || '', sku: null, quantity: q,
              unit: action.item.unit || (action.item.itemType === 'product' ? 'pza' : 'servicio'),
              unitPrice: p, discountRate: d, subtotal: s, taxRate: t, taxAmount: s * t, taxRate2: 0, taxAmount2: 0 });
          } break;
          case 'update': { const i = action.index ?? -1; if (i >= 0 && action.updates) {
            const item = { ...result[i], ...action.updates };
            const base = item.quantity * item.unitPrice, sub = base - base * item.discountRate;
            item.subtotal = sub; item.taxAmount = sub * item.taxRate; item.taxAmount2 = sub * item.taxRate2;
            result[i] = item;
          } break; }
          case 'remove': { const i = action.index ?? -1; if (i >= 0) result = result.filter((_, idx) => idx !== i); break; }
          case 'replace_all': if (action.items) {
            result = action.items.map((it, i) => {
              const q = it.quantity || 1, p = it.unitPrice || 0, d = it.discountRate || 0;
              const t = it.taxRate ?? 0.16, s = q * p * (1 - d);
              return { tempId: `chat-${Date.now()}-${i}`, productId: null, itemType: it.itemType || 'service',
                description: it.description || '', sku: null, quantity: q,
                unit: it.unit || (it.itemType === 'product' ? 'pza' : 'servicio'),
                unitPrice: p, discountRate: d, subtotal: s, taxRate: t, taxAmount: s * t, taxRate2: 0, taxAmount2: 0 };
            });
          } break;
        }
      }
      return result;
    });
  }, []);

  const handleSubmit = async () => {
    if (!session?.user?.email || !selectedPatient) { toast.error('Debe seleccionar un paciente'); return; }
    if (form.items.length === 0) { toast.error('Debe agregar al menos un servicio'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ventas`, {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatient.id, visitaId: desdeVisita ? visitaId : null, saleDate: form.saleDate,
          deliveryDate: form.deliveryDate || null, status: 'PENDING',
          paymentStatus: form.paymentStatus, amountPaid: form.amountPaid,
          items: form.items.map(it => ({
            productId: it.productId, itemType: it.itemType, description: it.description,
            sku: it.sku, quantity: it.quantity, unit: it.unit, unitPrice: it.unitPrice,
            discountRate: it.discountRate, taxRate: it.taxRate, taxAmount: it.taxAmount,
            taxRate2: it.taxRate2, taxAmount2: it.taxAmount2,
          })),
          notes: form.notes, termsAndConditions: form.termsAndConditions, taxRate: 0.16,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al crear venta'); }
      // Born in a visita → back to that visita, where it now shows under «Ventas».
      router.push(desdeVisita
        ? `/dashboard/medical-records/patients/${patientIdParam}/visitas/${visitaId}`
        : '/dashboard/practice/ventas');
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const subtotal = form.calculateSubtotal(), tax = form.calculateTax(), tax2 = form.calculateTax2(), total = form.calculateTotal();

  if (status === 'loading' || form.loadingProducts || loadingPatients) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="inline-block h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Link
            href={desdeVisita ? `/dashboard/medical-records/patients/${patientIdParam}/visitas/${visitaId}` : '/dashboard/practice/ventas'}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            {desdeVisita ? 'Volver a la visita' : 'Volver a Ventas'}
          </Link>
          {aiAllowed && (
          <button
            onClick={() => setChatPanelOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Chat IA
          </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Venta</h1>
        <p className="text-gray-600 mt-1">Registra una nueva venta en firme</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Paciente</h2>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Paciente *</label>
              <select
                value={selectedPatient?.id ?? ''}
                onChange={handleSelectionChange}
                disabled={desdeVisita}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
              >
                <option value="">Seleccionar paciente...</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
              {desdeVisita && (
                <p className="text-xs text-gray-500 mt-1">Esta venta se registra en la visita del paciente.</p>
              )}
              {patientsError && (
                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                  No se pudieron cargar tus pacientes. Recarga la página para intentar de nuevo.
                </p>
              )}
            </div>

            {selectedPatient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-xl">✓</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                    {selectedPatient.internalId && <div className="text-sm text-gray-600">ID interno: {selectedPatient.internalId}</div>}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha del servicio *</label>
              <input type="date" value={form.saleDate} onChange={e => form.setSaleDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado de pago *</label>
                <select value={form.paymentStatus} onChange={e => form.setPaymentStatus(e.target.value as 'PENDING' | 'PARTIAL' | 'PAID')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="PENDING">Pendiente</option>
                  <option value="PARTIAL">Pago Parcial</option>
                  <option value="PAID">Pagada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto pagado {form.paymentStatus === 'PAID' && '(Auto)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input type="number" min="0" step="0.01" max={total}
                    value={form.amountPaid}
                    onChange={e => form.setAmountPaid(parseFloat(e.target.value) || 0)}
                    disabled={form.paymentStatus === 'PENDING' || form.paymentStatus === 'PAID'}
                    className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      form.paymentStatus !== 'PARTIAL' ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                    }`}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {form.paymentStatus === 'PENDING' && '⚠️ Pendiente: Monto pagado es $0'}
                  {form.paymentStatus === 'PAID' && `✓ Pagado: Igualado al total ($${total.toFixed(2)})`}
                  {form.paymentStatus === 'PARTIAL' && `Ingrese el monto pagado (Total: $${total.toFixed(2)})`}
                </p>
              </div>
            </div>
          </div>

          {/* Doble cobro: la cita de esta visita ya cobra (o cobrará al concluirse) su servicio; si la
              venta lo trae también, cuenta dos veces. Aviso, no bloqueo (puede ser otra consulta). */}
          {desdeVisita && citaServicio && form.items.some(it => it.description.trim().toLowerCase() === citaServicio.trim().toLowerCase()) && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-3 text-sm">
              <p className="font-semibold">⚠️ «{citaServicio}» ya es el servicio de la cita de esta visita.</p>
              <p className="mt-1">
                {citaCobrada
                  ? 'Su cobro ya está en Flujo de Dinero: si también lo vendes aquí, se cuenta dos veces.'
                  : 'Se cobra al concluir la cita: si también lo vendes aquí, se contará dos veces.'}
                {' '}Agrégalo sólo si es un servicio adicional.
              </p>
            </div>
          )}

          <SaleItemsSection
            items={form.items} citaServiceNames={form.citaServiceNames}
            taxColumnLabel={form.taxColumnLabel} taxColumnLabel2={form.taxColumnLabel2}
            onTaxColumnLabelChange={form.setTaxColumnLabel} onTaxColumnLabel2Change={form.setTaxColumnLabel2}
            onOpenServiceModal={() => { form.setProductTypeFilter('service'); form.setProductSearch(''); form.setShowProductModal(true); }}
            onOpenProductModal={() => { form.setProductTypeFilter('product'); form.setProductSearch(''); form.setShowProductModal(true); }}
            onOpenCustomModal={() => { form.setCustomItemType('product'); form.setCustomUnit('pza'); form.setShowCustomItemModal(true); }}
            onRemoveItem={form.removeItem}
            onUpdateQuantity={form.updateItemQuantity} onUpdatePrice={form.updateItemPrice}
            onUpdateDiscount={form.updateItemDiscount} onUpdateTaxRate={form.updateItemTaxRate}
            onUpdateTaxRate2={form.updateItemTaxRate2}
          />

          {/* Notes */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas y Términos</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales</label>
              <textarea value={form.notes} onChange={e => form.setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" rows={3}
                placeholder="Añade notas sobre esta venta..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Términos y condiciones</label>
              <textarea value={form.termsAndConditions} onChange={e => form.setTermsAndConditions(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500" rows={3}
                placeholder="Ej: Pago 50% anticipo, 50% contra entrega..." />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1">
          <SaleSummaryCard
            itemCount={form.items.length} subtotal={subtotal} tax={tax} tax2={tax2} total={total}
            taxColumnLabel={form.taxColumnLabel} taxColumnLabel2={form.taxColumnLabel2}
            amountPaid={form.amountPaid} paymentStatus={form.paymentStatus}
            submitting={submitting} canSubmit={!!selectedPatient && form.items.length > 0}
            submitLabel="Guardar Venta" submittingLabel="Guardando..."
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Modals */}
      {form.showProductModal && (
        <SaleProductModal
          products={form.filteredProducts} citaServices={form.filteredCitaServices} citaServicesError={form.citaServicesError}
          productSearch={form.productSearch} onProductSearchChange={form.setProductSearch}
          productTypeFilter={form.productTypeFilter}
          onSelect={form.addProductToSale} onSelectCitaService={form.addCitaServiceToSale}
          onClose={() => form.setShowProductModal(false)}
        />
      )}
      {form.showCustomItemModal && (
        <SaleCustomItemModal
          customItemType={form.customItemType} customDescription={form.customDescription}
          customQuantity={form.customQuantity} customUnit={form.customUnit} customPrice={form.customPrice}
          onTypeChange={form.setCustomItemType} onDescriptionChange={form.setCustomDescription}
          onQuantityChange={form.setCustomQuantity} onUnitChange={form.setCustomUnit}
          onPriceChange={form.setCustomPrice}
          onAdd={form.addCustomItemToSale} onClose={() => form.setShowCustomItemModal(false)}
        />
      )}
      {showVoiceModal && session?.user?.email && (
        <VoiceRecordingModal isOpen={showVoiceModal} onClose={() => setShowVoiceModal(false)}
          sessionType="CREATE_SALE" onComplete={handleVoiceModalComplete} />
      )}
      {/* saleContext.clients = patients as NAME SUGGESTIONS only: `onClientSelect` is wired nowhere,
          so the positional ids are never used as ids. */}
      {showVoiceSidebar && session?.user?.email && (
        <VoiceChatSidebar isOpen={showVoiceSidebar} onClose={() => { setShowVoiceSidebar(false); setVoiceInitialData(null); }}
          sessionType="CREATE_SALE" patientId="sale" doctorId={session.user.email}
          onConfirm={handleVoiceConfirm} initialData={voiceInitialData}
          saleContext={{ clients: patients.map((p, i) => ({ id: i, businessName: `${p.firstName} ${p.lastName}` })), products: form.products }} />
      )}
      {chatPanelOpen && (
        <SaleChatPanel onClose={() => setChatPanelOpen(false)} currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates} onUpdateItems={handleChatItemActions} />
      )}
    </div>
  );
}
