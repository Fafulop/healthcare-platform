"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Save, Loader2, FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import { QuotationChatPanel } from "@/components/practice/QuotationChatPanel";
import type { QuotationFormData, QuotationChatItem, QuotationItemAction } from "@/hooks/useQuotationChat";
import { useQuotationForm } from '../_components/useQuotationForm';
import { QuotationClientSection } from '../_components/QuotationClientSection';
import { QuotationItemsSection } from '../_components/QuotationItemsSection';
import { QuotationProductModal } from '../_components/QuotationProductModal';
import { QuotationCustomItemModal } from '../_components/QuotationCustomItemModal';
import { QuotationSummaryCard } from '../_components/QuotationSummaryCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function NewCotizacionPage() {
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
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const {
    clients, products, patients,
    loadingClients, loadingProducts, loadingPatients,
    fetchClients, fetchProducts, fetchPatients,
    selectedPatient, setSelectedPatient,
    resolvingPatient,
    selectedClientId, setSelectedClientId,
    issueDate, setIssueDate,
    validUntil, setValidUntil,
    notes, setNotes,
    termsAndConditions, setTermsAndConditions,
    items, setItems,
    taxColumnLabel, setTaxColumnLabel,
    taxColumnLabel2, setTaxColumnLabel2,
    showProductModal, setShowProductModal,
    showCustomItemModal, setShowCustomItemModal,
    productSearch, setProductSearch,
    productTypeFilter, setProductTypeFilter,
    customItemType, setCustomItemType,
    customDescription, setCustomDescription,
    customQuantity, setCustomQuantity,
    customUnit, setCustomUnit,
    customPrice, setCustomPrice,
    handleSelectionChange,
    resolvePatientAsClient,
    addProductToQuote, addCustomItemToQuote,
    removeItem, updateItemQuantity, updateItemPrice,
    updateItemDiscount, updateItemTaxRate, updateItemTaxRate2,
    calculateSubtotal, calculateTax, calculateTax2, calculateTotal,
    selectedClient, selectValue, filteredProducts,
  } = useQuotationForm();

  useEffect(() => {
    fetchClients();
    fetchProducts();
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open chat panel from hub widget
  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  // Pre-select client from URL parameter
  useEffect(() => {
    const clientIdParam = searchParams.get('clientId');
    if (clientIdParam && clients.length > 0) {
      const clientId = parseInt(clientIdParam);
      if (clients.find(c => c.id === clientId)) {
        setSelectedClientId(clientId);
      }
    }
  }, [searchParams, clients]);

  // Auto-set validUntil to 30 days from issueDate
  useEffect(() => {
    const issue = new Date(issueDate);
    const valid = new Date(issue);
    valid.setDate(valid.getDate() + 30);
    setValidUntil(valid.toISOString().split('T')[0]);
  }, [issueDate]);

  const chatFormData: QuotationFormData = useMemo(() => {
    const clientName = selectedPatient
      ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
      : selectedClient?.businessName || '';
    return {
      clientName,
      issueDate,
      validUntil,
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
    };
  }, [clients, selectedClientId, selectedPatient, issueDate, validUntil, notes, termsAndConditions, items]);

  const handleChatFieldUpdates = useCallback((updates: Record<string, any>) => {
    if (updates.clientName) {
      const name = updates.clientName;
      const matchedClient = clients.find(
        c => c.businessName.toLowerCase().includes(name.toLowerCase()) ||
          c.contactName?.toLowerCase().includes(name.toLowerCase())
      );
      if (matchedClient) {
        setSelectedClientId(matchedClient.id);
        setSelectedPatient(null);
      } else {
        const matchedPatient = patients.find(
          p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(name.toLowerCase()) ||
            p.firstName.toLowerCase().includes(name.toLowerCase()) ||
            p.lastName.toLowerCase().includes(name.toLowerCase())
        );
        if (matchedPatient) {
          setSelectedPatient(matchedPatient);
          resolvePatientAsClient(matchedPatient);
        }
      }
    }
    if (updates.issueDate) setIssueDate(updates.issueDate);
    if (updates.validUntil) setValidUntil(updates.validUntil);
    if (updates.notes) setNotes(updates.notes);
    if (updates.termsAndConditions) setTermsAndConditions(updates.termsAndConditions);
  }, [clients, patients]);

  const handleChatItemActions = useCallback((actions: QuotationItemAction[]) => {
    setItems(prev => {
      let result = [...prev];
      for (const action of actions) {
        switch (action.type) {
          case 'add': {
            if (action.item) {
              const quantity = action.item.quantity || 1;
              const unitPrice = action.item.unitPrice || 0;
              const discountRate = action.item.discountRate || 0;
              const taxRate = action.item.taxRate !== undefined ? action.item.taxRate : 0.16;
              const baseAmount = quantity * unitPrice;
              const discountAmount = baseAmount * discountRate;
              const subtotal = baseAmount - discountAmount;
              const taxAmount = subtotal * taxRate;
              result.push({
                tempId: `chat-${Date.now()}-${result.length}`,
                productId: null,
                itemType: action.item.itemType || 'service',
                description: action.item.description || '',
                sku: null,
                quantity,
                unit: action.item.unit || (action.item.itemType === 'product' ? 'pza' : 'servicio'),
                unitPrice,
                discountRate,
                subtotal,
                taxRate,
                taxAmount,
                taxRate2: 0,
                taxAmount2: 0,
              });
            }
            break;
          }
          case 'update': {
            const idx = action.index ?? -1;
            if (idx >= 0 && idx < result.length && action.updates) {
              const item = { ...result[idx], ...action.updates };
              const baseAmount = item.quantity * item.unitPrice;
              const discountAmount = baseAmount * item.discountRate;
              item.subtotal = baseAmount - discountAmount;
              item.taxAmount = item.subtotal * item.taxRate;
              item.taxAmount2 = item.subtotal * item.taxRate2;
              result[idx] = item;
            }
            break;
          }
          case 'remove': {
            const idx = action.index ?? -1;
            if (idx >= 0 && idx < result.length) {
              result = result.filter((_, i) => i !== idx);
            }
            break;
          }
          case 'replace_all': {
            if (action.items) {
              result = action.items.map((it, i) => {
                const quantity = it.quantity || 1;
                const unitPrice = it.unitPrice || 0;
                const discountRate = it.discountRate || 0;
                const taxRate = it.taxRate !== undefined ? it.taxRate : 0.16;
                const baseAmount = quantity * unitPrice;
                const discountAmount = baseAmount * discountRate;
                const subtotal = baseAmount - discountAmount;
                const taxAmount = subtotal * taxRate;
                return {
                  tempId: `chat-${Date.now()}-${i}`,
                  productId: null,
                  itemType: it.itemType || 'service',
                  description: it.description || '',
                  sku: null,
                  quantity,
                  unit: it.unit || (it.itemType === 'product' ? 'pza' : 'servicio'),
                  unitPrice,
                  discountRate,
                  subtotal,
                  taxRate,
                  taxAmount,
                  taxRate2: 0,
                  taxAmount2: 0,
                };
              });
            }
            break;
          }
        }
      }
      return result;
    });
  }, []);

  const handleSubmit = async (saveStatus: 'DRAFT' | 'SENT') => {
    if (!selectedClientId) {
      toast.error('Debe seleccionar un paciente');
      return;
    }
    if (items.length === 0) {
      toast.error('Debe agregar al menos un servicio');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const requestBody = {
        clientId: selectedClientId,
        issueDate,
        validUntil,
        status: saveStatus,
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

      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear cotización');
      }

      router.push('/dashboard/practice/cotizaciones');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const tax2 = calculateTax2();
  const total = calculateTotal();

  if (status === "loading" || loadingClients || loadingProducts || loadingPatients) {
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <Link
          href="/dashboard/practice/cotizaciones"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Cotizaciones
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Nueva Cotización
          </h1>
          <button
            type="button"
            onClick={() => setChatPanelOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Chat IA
          </button>
        </div>
        <p className="text-gray-600 mt-2">Crea una cotización profesional para tu paciente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuotationClientSection
            patients={patients}
            clients={clients}
            selectedPatient={selectedPatient}
            selectedClient={selectedClient}
            selectValue={selectValue}
            resolvingPatient={resolvingPatient}
            issueDate={issueDate}
            validUntil={validUntil}
            error={error}
            showValidUntilHint
            onSelectionChange={handleSelectionChange}
            onIssueDateChange={setIssueDate}
            onValidUntilChange={setValidUntil}
          />

          <QuotationItemsSection
            items={items}
            taxColumnLabel={taxColumnLabel}
            taxColumnLabel2={taxColumnLabel2}
            onTaxColumnLabelChange={setTaxColumnLabel}
            onTaxColumnLabel2Change={setTaxColumnLabel2}
            onAddService={() => { setProductTypeFilter('service'); setProductSearch(''); setShowProductModal(true); }}
            onAddProduct={() => { setProductTypeFilter('product'); setProductSearch(''); setShowProductModal(true); }}
            onAddCustomItem={() => { setCustomItemType('product'); setCustomUnit('pza'); setShowCustomItemModal(true); }}
            onRemoveItem={removeItem}
            onUpdateQuantity={updateItemQuantity}
            onUpdatePrice={updateItemPrice}
            onUpdateDiscount={updateItemDiscount}
            onUpdateTaxRate={updateItemTaxRate}
            onUpdateTaxRate2={updateItemTaxRate2}
          />

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas y Términos</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Añade notas sobre esta cotización..."
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

        <div className="lg:col-span-1">
          <QuotationSummaryCard
            itemCount={items.length}
            subtotal={subtotal}
            tax={tax}
            tax2={tax2}
            total={total}
            taxColumnLabel={taxColumnLabel}
            taxColumnLabel2={taxColumnLabel2}
            submitting={submitting}
            canSubmit={!!selectedClientId && items.length > 0}
            submitLabel="Generar Cotización"
            submittingLabel="Generando..."
            onSaveAsDraft={() => handleSubmit('DRAFT')}
            onSubmit={() => handleSubmit('SENT')}
          />
        </div>
      </div>

      <QuotationProductModal
        show={showProductModal}
        productTypeFilter={productTypeFilter}
        products={filteredProducts}
        productSearch={productSearch}
        onSearchChange={setProductSearch}
        onSelect={addProductToQuote}
        onClose={() => { setShowProductModal(false); setProductSearch(''); }}
      />

      <QuotationCustomItemModal
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
        onAdd={addCustomItemToQuote}
        onClose={() => setShowCustomItemModal(false)}
      />

      {chatPanelOpen && (
        <QuotationChatPanel
          onClose={() => setChatPanelOpen(false)}
          currentFormData={chatFormData}
          onUpdateFields={handleChatFieldUpdates}
          onUpdateItems={handleChatItemActions}
        />
      )}
    </div>
  );
}
