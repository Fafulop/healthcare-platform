"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import { toast } from '@/lib/practice-toast';
import { usePurchaseForm } from '../../_components/usePurchaseForm';
import { PurchaseItemsSection } from '../../_components/PurchaseItemsSection';
import { PurchaseProductModal } from '../../_components/PurchaseProductModal';
import { PurchaseCustomItemModal } from '../../_components/PurchaseCustomItemModal';
import { PurchaseSummaryCard } from '../../_components/PurchaseSummaryCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface DoctorProfile {
  id: string;
  slug: string;
  doctorFullName: string;
  primarySpecialty: string;
}

export default function EditCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loadingPurchase, setLoadingPurchase] = useState(true);

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
    calculateSubtotal, calculateTax, calculateTax2, calculateTotal,
  } = usePurchaseForm();

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      setPurchaseId(resolvedParams.id);
    };
    loadParams();
  }, [params]);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    if (purchaseId) {
      fetchSuppliers();
      fetchProducts();
      fetchPurchase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();
      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) setDoctorProfile(doctor);
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchPurchase = async () => {
    if (!purchaseId) return;
    setLoadingPurchase(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`);
      if (!response.ok) throw new Error('Error al cargar compra');
      const result = await response.json();
      const purchase = result.data;

      setSelectedSupplierId(purchase.supplier.id);
      setPurchaseDate(purchase.purchaseDate.split('T')[0]);
      setDeliveryDate(purchase.deliveryDate ? purchase.deliveryDate.split('T')[0] : '');
      setNotes(purchase.notes || '');
      setTermsAndConditions(purchase.termsAndConditions || '');
      setPaymentStatus(purchase.paymentStatus);
      setAmountPaid(parseFloat(purchase.amountPaid || 0));

      setItems(purchase.items.map((item: any) => ({
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
      console.error('Error al cargar compra:', err);
      setError('Error al cargar la compra');
    } finally {
      setLoadingPurchase(false);
    }
  };

  const handleSubmit = async (saveStatus: 'PENDING' | 'CONFIRMED') => {
    if (!purchaseId) return;
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

      const response = await authFetch(`${API_URL}/api/practice-management/compras/${purchaseId}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar compra');
      }

      router.push(`/dashboard/practice/compras/${purchaseId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const tax2 = calculateTax2();
  const total = calculateTotal();

  if (status === "loading" || loadingSuppliers || loadingProducts || loadingPurchase) {
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
          href={`/dashboard/practice/compras/${purchaseId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la Compra
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="w-8 h-8 text-blue-600" />
          Editar Compra
        </h1>
        <p className="text-gray-600 mt-2">Modifica la información de la compra</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto pagado</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
            subtotal={subtotal}
            tax={tax}
            tax2={tax2}
            total={total}
            taxColumnLabel={taxColumnLabel}
            taxColumnLabel2={taxColumnLabel2}
            amountPaid={amountPaid}
            submitting={submitting}
            canSubmit={!!selectedSupplierId && items.length > 0}
            submitLabel="Actualizar Compra"
            submittingLabel="Actualizando..."
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
        onClose={() => { setShowProductModal(false); setProductSearch(''); }}
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
    </div>
  );
}
