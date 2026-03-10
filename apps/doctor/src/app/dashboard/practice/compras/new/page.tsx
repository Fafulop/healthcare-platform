"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import dynamic from 'next/dynamic';
import type { VoiceStructuredData, VoicePurchaseData } from '@/types/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';
import { PurchaseChatPanel } from '@/components/practice/PurchaseChatPanel';
import type { PurchaseFormData, PurchaseChatItem, PurchaseItemAction } from '@/hooks/usePurchaseChat';
import { usePurchaseForm } from '../_components/usePurchaseForm';
import { PurchaseItemsSection } from '../_components/PurchaseItemsSection';
import { PurchaseProductModal } from '../_components/PurchaseProductModal';
import { PurchaseCustomItemModal } from '../_components/PurchaseCustomItemModal';
import { PurchaseSummaryCard } from '../_components/PurchaseSummaryCard';
import type { PurchaseItem } from '../_components/purchase-types';

// Dynamically import voice assistant components (client-side only)
const VoiceRecordingModal = dynamic(
  () => import('@/components/voice-assistant/VoiceRecordingModal').then(mod => mod.VoiceRecordingModal),
  { ssr: false }
);

const VoiceChatSidebar = dynamic(
  () => import('@/components/voice-assistant/chat/VoiceChatSidebar').then(mod => mod.VoiceChatSidebar),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function NewCompraPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice assistant state
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVoiceSidebar, setShowVoiceSidebar] = useState(false);
  const [voiceInitialData, setVoiceInitialData] = useState<any>(null);

  // Chat IA state
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const {
    suppliers, products, loadingSuppliers, loadingProducts,
    fetchSuppliers, fetchProducts,
    selectedSupplierId, setSelectedSupplierId,
    purchaseDate, setPurchaseDate,
    deliveryDate, setDeliveryDate,
    notes, setNotes,
    termsAndConditions, setTermsAndConditions,
    paymentStatus, setPaymentStatus,
    amountPaid, setAmountPaid,
    items, setItems,
    taxColumnLabel, setTaxColumnLabel,
    taxColumnLabel2, setTaxColumnLabel2,
    addProductToPurchase, addCustomItemToPurchase,
    removeItem, updateItemQuantity, updateItemPrice,
    updateItemDiscount, updateItemTaxRate, updateItemTaxRate2,
    showProductModal, setShowProductModal,
    showCustomItemModal, setShowCustomItemModal,
    productSearch, setProductSearch,
    customItemType, setCustomItemType,
    customDescription, setCustomDescription,
    customQuantity, setCustomQuantity,
    customUnit, setCustomUnit,
    customPrice, setCustomPrice,
    filteredProducts,
    calculateTotal,
  } = usePurchaseForm();

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open chat panel from hub widget
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  // Load voice data from sessionStorage (hub widget flow)
  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voicePurchaseData');
      if (stored) {
        try {
          const { data } = JSON.parse(stored);
          handleVoiceConfirm(data);
          sessionStorage.removeItem('voicePurchaseData');
        } catch (e) {
          console.error('Error parsing voice purchase data:', e);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, suppliers]);

  useEffect(() => {
    const supplierIdParam = searchParams.get('supplierId');
    if (supplierIdParam && suppliers.length > 0) {
      const supplierId = parseInt(supplierIdParam);
      const supplierExists = suppliers.find(s => s.id === supplierId);
      if (supplierExists) {
        setSelectedSupplierId(supplierId);
      }
    }
  }, [searchParams, suppliers, setSelectedSupplierId]);

  const handleVoiceModalComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const allFields = Object.keys(data as VoicePurchaseData);
    const extracted = allFields.filter(
      k => (data as any)[k] != null &&
           (data as any)[k] !== '' &&
           !(Array.isArray((data as any)[k]) && (data as any)[k].length === 0)
    );

    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      sessionId,
      transcriptId,
      audioDuration,
      fieldsExtracted: extracted,
    };

    setVoiceInitialData(initialData);
    setShowVoiceModal(false);
    setShowVoiceSidebar(true);
  };

  const handleVoiceConfirm = (data: VoiceStructuredData) => {
    const purchaseData = data as VoicePurchaseData;


    if (purchaseData.supplierName) {
      const matchedSupplier = suppliers.find(
        (s) =>
          s.businessName.toLowerCase().includes(purchaseData.supplierName!.toLowerCase()) ||
          s.contactName?.toLowerCase().includes(purchaseData.supplierName!.toLowerCase())
      );
      if (matchedSupplier) {
        setSelectedSupplierId(matchedSupplier.id);
      }
    }

    if (purchaseData.purchaseDate) setPurchaseDate(purchaseData.purchaseDate);
    if (purchaseData.deliveryDate) setDeliveryDate(purchaseData.deliveryDate);
    if (purchaseData.paymentStatus) setPaymentStatus(purchaseData.paymentStatus);
    if (purchaseData.amountPaid !== null && purchaseData.amountPaid !== undefined) {
      setAmountPaid(purchaseData.amountPaid);
    }
    if (purchaseData.notes) setNotes(purchaseData.notes);
    if (purchaseData.termsAndConditions) setTermsAndConditions(purchaseData.termsAndConditions);

    if (purchaseData.items && purchaseData.items.length > 0) {
      const mappedItems: PurchaseItem[] = purchaseData.items.map((voiceItem, index) => {
        let matchedProduct = undefined;
        if (voiceItem.productName) {
          matchedProduct = products.find(
            (p) =>
              p.name.toLowerCase().includes(voiceItem.productName!.toLowerCase()) ||
              p.sku?.toLowerCase().includes(voiceItem.productName!.toLowerCase())
          );
        }

        if (!voiceItem.description && !voiceItem.productName) {
          return null;
        }

        const quantity = voiceItem.quantity || 1;
        const unitPrice = voiceItem.unitPrice || 0;
        const discountRate = voiceItem.discountRate || 0;
        const taxRate = voiceItem.taxRate !== null && voiceItem.taxRate !== undefined ? voiceItem.taxRate : 0.16;

        const baseAmount = quantity * unitPrice;
        const discountAmount = baseAmount * discountRate;
        const subtotal = baseAmount - discountAmount;
        const taxAmount = subtotal * taxRate;

        return {
          tempId: `voice-${Date.now()}-${index}`,
          productId: matchedProduct?.id || null,
          itemType: voiceItem.itemType,
          description: voiceItem.description,
          sku: matchedProduct?.sku || voiceItem.sku || null,
          quantity,
          unit: voiceItem.unit || 'pza',
          unitPrice,
          discountRate,
          taxRate,
          taxAmount,
          taxRate2: 0,
          taxAmount2: 0,
          subtotal,
        };
      }).filter(Boolean) as PurchaseItem[];

      setItems(mappedItems);
    }

    setShowVoiceSidebar(false);
  };

  // Chat IA: current form data for the chat hook
  const chatFormData: PurchaseFormData = useMemo(() => ({
    supplierName: selectedSupplierId
      ? suppliers.find(s => s.id === selectedSupplierId)?.businessName || ''
      : '',
    purchaseDate,
    deliveryDate,
    paymentStatus,
    amountPaid,
    notes,
    termsAndConditions,
    itemCount: items.length,
    items: items.map(it => ({
      description: it.description,
      itemType: it.itemType,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discountRate: it.discountRate,
      taxRate: it.taxRate,
    })),
  }), [selectedSupplierId, suppliers, purchaseDate, deliveryDate, paymentStatus, amountPaid, notes, termsAndConditions, items]);

  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    if (updates.supplierName && typeof updates.supplierName === 'string') {
      const name = updates.supplierName.toLowerCase();
      const match = suppliers.find(
        s => s.businessName.toLowerCase().includes(name) ||
             s.contactName?.toLowerCase().includes(name)
      );
      if (match) setSelectedSupplierId(match.id);
    }
    if (updates.purchaseDate) setPurchaseDate(updates.purchaseDate);
    if (updates.deliveryDate) setDeliveryDate(updates.deliveryDate);
    if (updates.paymentStatus) setPaymentStatus(updates.paymentStatus);
    if (updates.amountPaid !== undefined) setAmountPaid(Number(updates.amountPaid) || 0);
    if (updates.notes) setNotes(updates.notes);
    if (updates.termsAndConditions) setTermsAndConditions(updates.termsAndConditions);
  }, [suppliers, setSelectedSupplierId, setPurchaseDate, setDeliveryDate, setPaymentStatus, setAmountPaid, setNotes, setTermsAndConditions]);

  const handleChatItemActions = useCallback((actions: PurchaseItemAction[]) => {
    setItems(prev => {
      let result = [...prev];
      for (const action of actions) {
        switch (action.type) {
          case 'add': {
            if (!action.item) break;
            const ai = action.item;
            const quantity = ai.quantity || 1;
            const unitPrice = ai.unitPrice || 0;
            const discountRate = ai.discountRate || 0;
            const taxRate = ai.taxRate !== undefined ? ai.taxRate : 0.16;
            const baseAmount = quantity * unitPrice;
            const discountAmount = baseAmount * discountRate;
            const subtotal = baseAmount - discountAmount;
            const taxAmount = subtotal * taxRate;
            result.push({
              tempId: `chat-${Date.now()}-${result.length}`,
              productId: null,
              itemType: ai.itemType || 'product',
              description: ai.description || '',
              sku: null,
              quantity,
              unit: ai.unit || 'pza',
              unitPrice,
              discountRate,
              taxRate,
              taxAmount,
              taxRate2: 0,
              taxAmount2: 0,
              subtotal,
            });
            break;
          }
          case 'update': {
            if (action.index === undefined || !action.updates) break;
            const idx = action.index;
            if (idx >= 0 && idx < result.length) {
              const old = result[idx];
              const merged = { ...old, ...action.updates };
              const q = merged.quantity;
              const up = merged.unitPrice;
              const dr = merged.discountRate;
              const tr = merged.taxRate;
              const base = q * up;
              const disc = base * dr;
              const sub = base - disc;
              const tax = sub * tr;
              result[idx] = { ...merged, subtotal: sub, taxAmount: tax, taxAmount2: old.subtotal * old.taxRate2 };
            }
            break;
          }
          case 'remove': {
            if (action.index !== undefined && action.index >= 0 && action.index < result.length) {
              result = result.filter((_, i) => i !== action.index);
            }
            break;
          }
          case 'replace_all': {
            if (!action.items) break;
            result = action.items.map((ai, i) => {
              const quantity = ai.quantity || 1;
              const unitPrice = ai.unitPrice || 0;
              const discountRate = ai.discountRate || 0;
              const taxRate = ai.taxRate !== undefined ? ai.taxRate : 0.16;
              const baseAmount = quantity * unitPrice;
              const discountAmount = baseAmount * discountRate;
              const subtotal = baseAmount - discountAmount;
              const taxAmount = subtotal * taxRate;
              return {
                tempId: `chat-${Date.now()}-${i}`,
                productId: null,
                itemType: ai.itemType || 'product',
                description: ai.description || '',
                sku: null,
                quantity,
                unit: ai.unit || 'pza',
                unitPrice,
                discountRate,
                taxRate,
                taxAmount,
                taxRate2: 0,
                taxAmount2: 0,
                subtotal,
              };
            });
            break;
          }
        }
      }
      return result;
    });
  }, [setItems]);

  const handleSubmit = async (saveStatus: 'PENDING' | 'CONFIRMED') => {
    if (!selectedSupplierId) {
      toast.error('Debe seleccionar un proveedor');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe agregar al menos un producto o servicio');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const requestBody = {
        supplierId: selectedSupplierId,
        purchaseDate,
        deliveryDate: deliveryDate || null,
        status: saveStatus,
        paymentStatus,
        amountPaid,
        items: items.map(item => ({
          productId: item.productId,
          itemType: item.itemType,
          description: item.description,
          sku: item.sku,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountRate: item.discountRate,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          taxRate2: item.taxRate2,
          taxAmount2: item.taxAmount2,
        })),
        notes,
        termsAndConditions,
        taxRate: 0.16,
      };

      const response = await authFetch(`${API_URL}/api/practice-management/compras`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear compra');
      }

      router.push('/dashboard/practice/compras');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const total = calculateTotal();

  if (status === "loading" || loadingSuppliers || loadingProducts) {
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
            href="/dashboard/practice/compras"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Compras
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatPanelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              title="Chat IA"
            >
              <Sparkles className="w-4 h-4" />
              Chat IA
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Compra</h1>
        <p className="text-gray-600 mt-1">Registra una nueva compra</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Proveedor</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor *</label>
              <select
                value={selectedSupplierId || ''}
                onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.businessName} {s.contactName ? `- ${s.contactName}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-xl">✓</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{selectedSupplier.businessName}</div>
                    {selectedSupplier.contactName && (
                      <div className="text-sm text-gray-600">Contacto: {selectedSupplier.contactName}</div>
                    )}
                    {selectedSupplier.email && (
                      <div className="text-sm text-gray-600">📧 {selectedSupplier.email}</div>
                    )}
                    {selectedSupplier.phone && (
                      <div className="text-sm text-gray-600">📞 {selectedSupplier.phone}</div>
                    )}
                    {selectedSupplier.rfc && (
                      <div className="text-sm text-gray-600">RFC: {selectedSupplier.rfc}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de compra *</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de entrega</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">(Opcional)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado de pago *</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'PENDING' | 'PARTIAL' | 'PAID')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="PARTIAL">Pago Parcial</option>
                  <option value="PAID">Pagada</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto pagado {paymentStatus === 'PAID' && '(Auto)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={total}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    disabled={paymentStatus === 'PENDING' || paymentStatus === 'PAID'}
                    className={`w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      paymentStatus === 'PENDING' || paymentStatus === 'PAID'
                        ? 'bg-gray-100 cursor-not-allowed text-gray-500'
                        : ''
                    }`}
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {paymentStatus === 'PENDING' && '⚠️ Pendiente: Monto pagado es $0'}
                  {paymentStatus === 'PAID' && `✓ Pagado: Igualado al total ($${total.toFixed(2)})`}
                  {paymentStatus === 'PARTIAL' && `Ingrese el monto pagado (Total: $${total.toFixed(2)})`}
                </p>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <PurchaseItemsSection
            items={items}
            taxColumnLabel={taxColumnLabel}
            taxColumnLabel2={taxColumnLabel2}
            onTaxColumnLabelChange={setTaxColumnLabel}
            onTaxColumnLabel2Change={setTaxColumnLabel2}
            onAddFromCatalog={() => setShowProductModal(true)}
            onAddCustomProduct={() => { setCustomItemType('product'); setCustomUnit('pza'); setShowCustomItemModal(true); }}
            onAddCustomService={() => { setCustomItemType('service'); setCustomUnit('servicio'); setShowCustomItemModal(true); }}
            onRemoveItem={removeItem}
            onUpdateQuantity={updateItemQuantity}
            onUpdatePrice={updateItemPrice}
            onUpdateDiscount={updateItemDiscount}
            onUpdateTaxRate={updateItemTaxRate}
            onUpdateTaxRate2={updateItemTaxRate2}
          />

          {/* Notes and Terms */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas y Términos</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Añade notas sobre esta compra..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Términos y condiciones</label>
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Ej: Pago 50% anticipo, 50% contra entrega..."
              />
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1">
          <PurchaseSummaryCard
            itemCount={items.length}
            subtotal={items.reduce((s, i) => s + i.subtotal, 0)}
            tax={items.reduce((s, i) => s + i.taxAmount, 0)}
            tax2={items.reduce((s, i) => s + i.taxAmount2, 0)}
            total={total}
            taxColumnLabel={taxColumnLabel}
            taxColumnLabel2={taxColumnLabel2}
            amountPaid={amountPaid}
            submitting={submitting}
            canSubmit={!!selectedSupplierId && items.length > 0}
            submitLabel="Guardar Compra"
            submittingLabel="Guardando..."
            onSubmit={() => handleSubmit('PENDING')}
          />
        </div>
      </div>

      {/* Modals */}
      <PurchaseProductModal
        show={showProductModal}
        products={filteredProducts}
        productSearch={productSearch}
        onSearchChange={setProductSearch}
        onSelect={addProductToPurchase}
        onClose={() => setShowProductModal(false)}
      />

      <PurchaseCustomItemModal
        show={showCustomItemModal}
        itemType={customItemType}
        description={customDescription}
        quantity={customQuantity}
        unit={customUnit}
        price={customPrice}
        onDescriptionChange={setCustomDescription}
        onQuantityChange={setCustomQuantity}
        onUnitChange={setCustomUnit}
        onPriceChange={setCustomPrice}
        onAdd={addCustomItemToPurchase}
        onClose={() => setShowCustomItemModal(false)}
      />

      {/* Chat IA Panel */}
      {chatPanelOpen && (
        <PurchaseChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates}
          onUpdateItems={handleChatItemActions}
        />
      )}

      {/* Voice Assistant Modal */}
      {showVoiceModal && session?.user?.email && (
        <VoiceRecordingModal
          isOpen={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          sessionType="CREATE_PURCHASE"
          onComplete={handleVoiceModalComplete}
        />
      )}

      {/* Voice Assistant Sidebar */}
      {showVoiceSidebar && session?.user?.email && (
        <VoiceChatSidebar
          isOpen={showVoiceSidebar}
          onClose={() => {
            setShowVoiceSidebar(false);
            setVoiceInitialData(null);
          }}
          sessionType="CREATE_PURCHASE"
          patientId="purchase"
          doctorId={session.user.email}
          onConfirm={handleVoiceConfirm}
          initialData={voiceInitialData}
          purchaseContext={{
            suppliers: suppliers,
            products: products,
          }}
        />
      )}
    </div>
  );
}
