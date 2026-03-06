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

const VoiceRecordingModal = dynamic(
  () => import('@/components/voice-assistant/VoiceRecordingModal').then(m => m.VoiceRecordingModal),
  { ssr: false }
);
const VoiceChatSidebar = dynamic(
  () => import('@/components/voice-assistant/chat/VoiceChatSidebar').then(m => m.VoiceChatSidebar),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Patient {
  id: string;
  internalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export default function NewVentaPage() {
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { redirect('/login'); } });
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useSaleForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patients
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [resolvingPatient, setResolvingPatient] = useState(false);

  // Voice / Chat
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVoiceSidebar, setShowVoiceSidebar] = useState(false);
  const [voiceInitialData, setVoiceInitialData] = useState<any>(null);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      form.fetchClients();
      form.fetchProducts();
      fetchPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  useEffect(() => {
    if (searchParams.get('chat') === 'true') setChatPanelOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceSaleData');
      if (stored) {
        try { handleVoiceConfirm(JSON.parse(stored).data); sessionStorage.removeItem('voiceSaleData'); }
        catch (e) { console.error('Error parsing voice sale data:', e); }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, form.clients, patients]);

  useEffect(() => {
    const clientIdParam = searchParams.get('clientId');
    if (clientIdParam && form.clients.length > 0) {
      const id = parseInt(clientIdParam);
      if (form.clients.find(c => c.id === id)) {
        form.setSelectedClientId(id);
        setSelectedPatient(null);
      }
    }
  }, [searchParams, form.clients]);

  const fetchPatients = async () => {
    try {
      const res = await fetch('/api/medical-records/patients?status=active');
      if (!res.ok) throw new Error('Error al cargar pacientes');
      const data = await res.json();
      setPatients(data.data || []);
    } catch (err) { console.error('Error al cargar pacientes:', err); }
    finally { setLoadingPatients(false); }
  };

  const resolvePatientAsClient = async (patient: Patient) => {
    setResolvingPatient(true);
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const existing = form.clients.find(c => c.businessName === fullName);
    if (existing) { form.setSelectedClientId(existing.id); setResolvingPatient(false); return; }
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/clients`, {
        method: 'POST',
        body: JSON.stringify({ businessName: fullName, contactName: fullName, email: patient.email || null, phone: patient.phone || null }),
      });
      if (res.ok) {
        const result = await res.json();
        form.setClients(prev => [...prev, result.data]);
        form.setSelectedClientId(result.data.id);
      } else if (res.status === 409) {
        const refreshRes = await authFetch(`${API_URL}/api/practice-management/clients?status=active`);
        const refreshResult = await refreshRes.json();
        const refreshed = refreshResult.data || [];
        form.setClients(refreshed);
        const found = refreshed.find((c: any) => c.businessName === fullName);
        if (found) form.setSelectedClientId(found.id);
      }
    } catch (err) { console.error('Error al crear cliente desde paciente:', err); }
    finally { setResolvingPatient(false); }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) { form.setSelectedClientId(null); setSelectedPatient(null); return; }
    if (value.startsWith('patient:')) {
      const patient = patients.find(p => p.id === value.slice('patient:'.length));
      if (patient) { setSelectedPatient(patient); resolvePatientAsClient(patient); }
    } else {
      form.setSelectedClientId(Number(value.slice('client:'.length)));
      setSelectedPatient(null);
    }
  };

  const handleVoiceModalComplete = (transcript: string, data: VoiceStructuredData, sessionId: string, transcriptId: string, audioDuration: number) => {
    setVoiceInitialData({ transcript, structuredData: data, sessionId, transcriptId, audioDuration });
    setShowVoiceModal(false);
    setShowVoiceSidebar(true);
  };

  const handleVoiceConfirm = useCallback((data: VoiceStructuredData) => {
    const saleData = data as VoiceSaleData;
    if (saleData.clientName) {
      const matchedClient = form.clients.find(c =>
        c.businessName.toLowerCase().includes(saleData.clientName!.toLowerCase()) ||
        c.contactName?.toLowerCase().includes(saleData.clientName!.toLowerCase())
      );
      if (matchedClient) { form.setSelectedClientId(matchedClient.id); setSelectedPatient(null); }
      else {
        const matchedPatient = patients.find(p =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(saleData.clientName!.toLowerCase())
        );
        if (matchedPatient) { setSelectedPatient(matchedPatient); resolvePatientAsClient(matchedPatient); }
      }
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
  }, [form.clients, form.products, patients]);

  const chatFormData: SaleFormData = useMemo(() => ({
    clientName: selectedPatient
      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
      : form.clients.find(c => c.id === form.selectedClientId)?.businessName || '',
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
  }), [form.clients, form.selectedClientId, selectedPatient, form.saleDate, form.deliveryDate,
       form.paymentStatus, form.amountPaid, form.notes, form.termsAndConditions, form.items]);

  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    if (updates.clientName) {
      const name = updates.clientName;
      const mc = form.clients.find(c =>
        c.businessName.toLowerCase().includes(name.toLowerCase()) ||
        c.contactName?.toLowerCase().includes(name.toLowerCase())
      );
      if (mc) { form.setSelectedClientId(mc.id); setSelectedPatient(null); }
      else {
        const mp = patients.find(p =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(name.toLowerCase())
        );
        if (mp) { setSelectedPatient(mp); resolvePatientAsClient(mp); }
      }
    }
    if (updates.saleDate) form.setSaleDate(updates.saleDate);
    if (updates.deliveryDate) form.setDeliveryDate(updates.deliveryDate);
    if (updates.paymentStatus) form.setPaymentStatus(updates.paymentStatus);
    if (updates.amountPaid !== undefined) form.setAmountPaid(updates.amountPaid);
    if (updates.notes) form.setNotes(updates.notes);
    if (updates.termsAndConditions) form.setTermsAndConditions(updates.termsAndConditions);
  }, [form.clients, patients]);

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
    if (!session?.user?.email || !form.selectedClientId) { toast.error('Debe seleccionar un paciente'); return; }
    if (form.items.length === 0) { toast.error('Debe agregar al menos un servicio'); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ventas`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: form.selectedClientId, saleDate: form.saleDate,
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
      router.push('/dashboard/practice/ventas');
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const selectedClient = form.clients.find(c => c.id === form.selectedClientId);
  const selectValue = selectedPatient ? `patient:${selectedPatient.id}` : form.selectedClientId ? `client:${form.selectedClientId}` : '';
  const subtotal = form.calculateSubtotal(), tax = form.calculateTax(), tax2 = form.calculateTax2(), total = form.calculateTotal();

  if (status === 'loading' || form.loadingClients || form.loadingProducts || loadingPatients) {
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
          <Link href="/dashboard/practice/ventas" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            Volver a Ventas
          </Link>
          <button
            onClick={() => setChatPanelOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Chat IA
          </button>
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
                value={selectValue}
                onChange={handleSelectionChange}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar paciente...</option>
                {patients.length > 0 && (
                  <optgroup label="Pacientes">
                    {patients.map(p => (
                      <option key={p.id} value={`patient:${p.id}`}>{p.firstName} {p.lastName}</option>
                    ))}
                  </optgroup>
                )}
                {(() => {
                  const patientNames = new Set(patients.map(p => `${p.firstName} ${p.lastName}`));
                  const ext = form.clients.filter(c => !patientNames.has(c.businessName));
                  return ext.length > 0 && (
                    <optgroup label="Clientes Externos">
                      {ext.map(c => (
                        <option key={c.id} value={`client:${c.id}`}>
                          {c.businessName}{c.contactName ? ` - ${c.contactName}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  );
                })()}
              </select>
              {resolvingPatient && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Preparando datos...
                </p>
              )}
            </div>

            {(selectedPatient || selectedClient) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-xl">✓</span>
                  <div className="flex-1">
                    {selectedPatient ? (
                      <>
                        <div className="font-semibold text-gray-900">{selectedPatient.firstName} {selectedPatient.lastName}</div>
                        <div className="text-xs text-blue-600 font-medium mt-0.5">Paciente</div>
                        {selectedPatient.internalId && <div className="text-sm text-gray-600">ID interno: {selectedPatient.internalId}</div>}
                        {selectedPatient.email && <div className="text-sm text-gray-600">📧 {selectedPatient.email}</div>}
                        {selectedPatient.phone && <div className="text-sm text-gray-600">📞 {selectedPatient.phone}</div>}
                      </>
                    ) : selectedClient ? (
                      <>
                        <div className="font-semibold text-gray-900">{selectedClient.businessName}</div>
                        {selectedClient.contactName && <div className="text-sm text-gray-600">Contacto: {selectedClient.contactName}</div>}
                        {selectedClient.email && <div className="text-sm text-gray-600">📧 {selectedClient.email}</div>}
                        {selectedClient.phone && <div className="text-sm text-gray-600">📞 {selectedClient.phone}</div>}
                        {selectedClient.rfc && <div className="text-sm text-gray-600">RFC: {selectedClient.rfc}</div>}
                      </>
                    ) : null}
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

          <SaleItemsSection
            items={form.items}
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
            submitting={submitting} canSubmit={!!form.selectedClientId && form.items.length > 0}
            submitLabel="Guardar Venta" submittingLabel="Guardando..."
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* Modals */}
      {form.showProductModal && (
        <SaleProductModal
          products={form.filteredProducts}
          productSearch={form.productSearch} onProductSearchChange={form.setProductSearch}
          productTypeFilter={form.productTypeFilter}
          onSelect={form.addProductToSale} onClose={() => form.setShowProductModal(false)}
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
      {showVoiceSidebar && session?.user?.email && (
        <VoiceChatSidebar isOpen={showVoiceSidebar} onClose={() => { setShowVoiceSidebar(false); setVoiceInitialData(null); }}
          sessionType="CREATE_SALE" patientId="sale" doctorId={session.user.email}
          onConfirm={handleVoiceConfirm} initialData={voiceInitialData}
          saleContext={{ clients: form.clients, products: form.products }} />
      )}
      {chatPanelOpen && (
        <SaleChatPanel onClose={() => setChatPanelOpen(false)} currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates} onUpdateItems={handleChatItemActions} />
      )}
    </div>
  );
}
