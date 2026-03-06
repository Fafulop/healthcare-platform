'use client';

import { useSession } from 'next-auth/react';
import { redirect, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import { useSaleForm } from '../../_components/useSaleForm';
import { SaleItemsSection } from '../../_components/SaleItemsSection';
import { SaleProductModal } from '../../_components/SaleProductModal';
import { SaleCustomItemModal } from '../../_components/SaleCustomItemModal';
import { SaleSummaryCard } from '../../_components/SaleSummaryCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function EditVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { redirect('/login'); } });
  const router = useRouter();

  const form = useSaleForm();
  const [saleId, setSaleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSale, setLoadingSale] = useState(true);

  useEffect(() => {
    params.then(p => setSaleId(p.id));
  }, [params]);

  useEffect(() => {
    if (session?.user?.email && saleId) {
      form.fetchClients();
      form.fetchProducts();
      fetchSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId, session?.user?.email]);

  const fetchSale = async () => {
    if (!saleId) return;
    setLoadingSale(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`);
      if (!res.ok) throw new Error('Error al cargar venta');
      const { data: sale } = await res.json();

      form.setSelectedClientId(sale.client.id);
      form.setSaleDate(sale.saleDate.split('T')[0]);
      form.setDeliveryDate(sale.deliveryDate ? sale.deliveryDate.split('T')[0] : '');
      form.setNotes(sale.notes || '');
      form.setTermsAndConditions(sale.termsAndConditions || '');
      form.setPaymentStatus(sale.paymentStatus);
      form.setAmountPaid(parseFloat(sale.amountPaid || '0'));
      form.setItems(sale.items.map((item: any) => ({
        tempId: `temp-${item.id}`,
        productId: item.productId,
        itemType: item.itemType,
        description: item.description,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
        discountRate: parseFloat(item.discountRate || '0'),
        subtotal: parseFloat(item.subtotal),
        taxRate: parseFloat(item.taxRate),
        taxAmount: parseFloat(item.taxAmount),
        taxRate2: parseFloat(item.taxRate2 || '0'),
        taxAmount2: parseFloat(item.taxAmount2 || '0'),
      })));
    } catch (err) {
      console.error('Error al cargar venta:', err);
      setError('Error al cargar la venta');
    } finally {
      setLoadingSale(false);
    }
  };

  const handleSubmit = async () => {
    if (!saleId || !form.selectedClientId) { toast.error('Debe seleccionar un paciente'); return; }
    if (form.items.length === 0) { toast.error('Debe agregar al menos un servicio'); return; }
    if (!session) return;
    setSubmitting(true); setError(null);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
        method: 'PUT',
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
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al actualizar venta'); }
      router.push(`/dashboard/practice/ventas/${saleId}`);
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const selectedClient = form.clients.find(c => c.id === form.selectedClientId);
  const subtotal = form.calculateSubtotal(), tax = form.calculateTax(), tax2 = form.calculateTax2(), total = form.calculateTotal();

  if (status === 'loading' || form.loadingClients || form.loadingProducts || loadingSale) {
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
        <Link href={`/dashboard/practice/ventas/${saleId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Volver a la Venta
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-blue-600" />
          Editar Venta
        </h1>
        <p className="text-gray-600 mt-2">Modifica la información de la venta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Paciente</h2>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Paciente *</label>
              <select value={form.selectedClientId || ''} onChange={e => form.setSelectedClientId(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">Seleccionar paciente...</option>
                {form.clients.map(c => (
                  <option key={c.id} value={c.id}>{c.businessName}{c.contactName ? ` - ${c.contactName}` : ''}</option>
                ))}
              </select>
            </div>

            {selectedClient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-xl">✓</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{selectedClient.businessName}</div>
                    {selectedClient.contactName && <div className="text-sm text-gray-600">Contacto: {selectedClient.contactName}</div>}
                    {selectedClient.email && <div className="text-sm text-gray-600">📧 {selectedClient.email}</div>}
                    {selectedClient.phone && <div className="text-sm text-gray-600">📞 {selectedClient.phone}</div>}
                    {selectedClient.rfc && <div className="text-sm text-gray-600">RFC: {selectedClient.rfc}</div>}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Monto pagado</label>
                <input type="number" min="0" step="0.01" value={form.amountPaid}
                  onChange={e => form.setAmountPaid(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
                placeholder="Ej: Garantía de 30 días, devoluciones aceptadas..." />
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
            submitLabel="Actualizar Venta" submittingLabel="Actualizando..."
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
    </div>
  );
}
