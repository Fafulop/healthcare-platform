"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import { useQuotationForm } from '../../_components/useQuotationForm';
import { QuotationClientSection } from '../../_components/QuotationClientSection';
import { QuotationItemsSection } from '../../_components/QuotationItemsSection';
import { QuotationProductModal } from '../../_components/QuotationProductModal';
import { QuotationCustomItemModal } from '../../_components/QuotationCustomItemModal';
import { QuotationSummaryCard } from '../../_components/QuotationSummaryCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function EditCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuotation, setLoadingQuotation] = useState(true);

  const {
    clients, products, patients,
    loadingClients, loadingProducts, loadingPatients,
    fetchClients, fetchProducts, fetchPatients,
    selectedPatient, setSelectedPatient,
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
    resolvingPatient,
    addProductToQuote, addCustomItemToQuote,
    removeItem, updateItemQuantity, updateItemPrice,
    updateItemDiscount, updateItemTaxRate, updateItemTaxRate2,
    calculateSubtotal, calculateTax, calculateTax2, calculateTotal,
    selectedClient, selectValue, filteredProducts,
  } = useQuotationForm();

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      setQuotationId(resolvedParams.id);
    };
    loadParams();
  }, [params]);

  useEffect(() => {
    if (quotationId) {
      fetchClients();
      fetchProducts();
      fetchPatients();
      fetchQuotation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const fetchQuotation = async () => {
    if (!quotationId) return;
    setLoadingQuotation(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`);
      if (!response.ok) throw new Error('Error al cargar cotización');
      const result = await response.json();
      const quotation = result.data;

      setSelectedClientId(quotation.client.id);
      setIssueDate(quotation.issueDate.split('T')[0]);
      setValidUntil(quotation.validUntil.split('T')[0]);
      setNotes(quotation.notes || '');
      setTermsAndConditions(quotation.termsAndConditions || '');

      setItems(quotation.items.map((item: any) => ({
        tempId: `temp-${item.id}`,
        productId: item.productId,
        itemType: item.itemType,
        description: item.description,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
        discountRate: parseFloat(item.discountRate || 0),
        subtotal: parseFloat(item.subtotal),
        taxRate: parseFloat(item.taxRate),
        taxAmount: parseFloat(item.taxAmount),
        taxRate2: parseFloat(item.taxRate2 || 0),
        taxAmount2: parseFloat(item.taxAmount2 || 0),
      })));
    } catch (err) {
      console.error('Error al cargar cotización:', err);
      setError('Error al cargar la cotización');
    } finally {
      setLoadingQuotation(false);
    }
  };

  const handleSubmit = async (saveStatus: 'DRAFT' | 'SENT') => {
    if (!quotationId) return;
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

      const response = await authFetch(`${API_URL}/api/practice-management/cotizaciones/${quotationId}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar cotización');
      }

      router.push(`/dashboard/practice/cotizaciones/${quotationId}`);
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

  if (status === "loading" || loadingClients || loadingProducts || loadingPatients || loadingQuotation) {
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
        <Link
          href={`/dashboard/practice/cotizaciones/${quotationId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Cotización
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Editar Cotización
        </h1>
        <p className="text-gray-600 mt-2">Modifica la información de la cotización</p>
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
            submitLabel="Actualizar Cotización"
            submittingLabel="Actualizando..."
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
    </div>
  );
}
