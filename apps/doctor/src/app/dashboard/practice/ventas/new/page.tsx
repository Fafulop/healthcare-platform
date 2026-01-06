"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ShoppingCart, X } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface Client {
  id: number;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  rfc: string | null;
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  price: string | null;
  unit: string | null;
  stockQuantity: number | null;
}

interface SaleItem {
  tempId: string;
  productId: number | null;
  itemType: 'product' | 'service';
  description: string;
  sku: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
}

export default function NewVentaPage() {
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

  // Data loading
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PARTIAL' | 'PAID'>('PENDING');
  const [amountPaid, setAmountPaid] = useState(0);

  // Items state
  const [items, setItems] = useState<SaleItem[]>([]);

  // Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Custom item modal state
  const [customItemType, setCustomItemType] = useState<'product' | 'service'>('service');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnit, setCustomUnit] = useState('servicio');
  const [customPrice, setCustomPrice] = useState(0);

  useEffect(() => {
    if (session?.user?.email) {
      fetchClients();
      fetchProducts();
    }
  }, [session]);

  useEffect(() => {
    const clientIdParam = searchParams.get('clientId');
    if (clientIdParam && clients.length > 0) {
      const clientId = parseInt(clientIdParam);
      const clientExists = clients.find(c => c.id === clientId);
      if (clientExists) {
        setSelectedClientId(clientId);
      }
    }
  }, [searchParams, clients]);

  const fetchClients = async () => {
    if (!session?.user?.email) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/clients?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar clientes');
      const result = await response.json();
      setClients(result.data || []);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchProducts = async () => {
    if (!session?.user?.email) return;

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const response = await fetch(`${API_URL}/api/practice-management/products?status=active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error al cargar productos');
      const result = await response.json();
      setProducts(result.data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const addProductToQuote = (product: Product) => {
    const unitPrice = parseFloat(product.price || '0');
    const quantity = 1;
    const discountRate = 0;
    const baseAmount = quantity * unitPrice;
    const discountAmount = baseAmount * discountRate;
    const subtotal = baseAmount - discountAmount;
    const taxRate = 0.16;
    const taxAmount = subtotal * taxRate;

    const newItem: SaleItem = {
      tempId: `temp-${Date.now()}`,
      productId: product.id,
      itemType: 'product',
      description: product.name,
      sku: product.sku,
      quantity,
      unit: product.unit || 'pza',
      unitPrice,
      discountRate,
      taxRate,
      taxAmount,
      subtotal
    };

    setItems([...items, newItem]);
    setShowProductModal(false);
    setProductSearch('');
  };

  const addCustomItemToQuote = () => {
    if (!customDescription || customPrice <= 0) {
      alert('Complete todos los campos requeridos');
      return;
    }

    const discountRate = 0;
    const baseAmount = customQuantity * customPrice;
    const discountAmount = baseAmount * discountRate;
    const subtotal = baseAmount - discountAmount;
    const taxRate = 0.16;
    const taxAmount = subtotal * taxRate;

    const newItem: SaleItem = {
      tempId: `temp-${Date.now()}`,
      productId: null,
      itemType: customItemType,
      description: customDescription,
      sku: null,
      quantity: customQuantity,
      unit: customUnit,
      unitPrice: customPrice,
      discountRate,
      taxRate,
      taxAmount,
      subtotal
    };

    setItems([...items, newItem]);
    setShowCustomItemModal(false);

    setCustomDescription('');
    setCustomQuantity(1);
    setCustomUnit('servicio');
    setCustomPrice(0);
    setCustomItemType('service');
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter(item => item.tempId !== tempId));
  };

  const updateItemQuantity = (tempId: string, quantity: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const baseAmount = quantity * item.unitPrice;
        const discountAmount = baseAmount * item.discountRate;
        const subtotal = baseAmount - discountAmount;
        const taxAmount = subtotal * item.taxRate;
        return { ...item, quantity, subtotal, taxAmount };
      }
      return item;
    }));
  };

  const updateItemPrice = (tempId: string, unitPrice: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const baseAmount = item.quantity * unitPrice;
        const discountAmount = baseAmount * item.discountRate;
        const subtotal = baseAmount - discountAmount;
        const taxAmount = subtotal * item.taxRate;
        return { ...item, unitPrice, subtotal, taxAmount };
      }
      return item;
    }));
  };

  const updateItemDiscount = (tempId: string, discountRate: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const baseAmount = item.quantity * item.unitPrice;
        const discountAmount = baseAmount * discountRate;
        const subtotal = baseAmount - discountAmount;
        const taxAmount = subtotal * item.taxRate;
        return { ...item, discountRate, subtotal, taxAmount };
      }
      return item;
    }));
  };

  const updateItemTaxRate = (tempId: string, taxRate: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const taxAmount = item.subtotal * taxRate;
        return { ...item, taxRate, taxAmount };
      }
      return item;
    }));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => sum + item.taxAmount, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    return subtotal + tax;
  };

  const handleSubmit = async (saveStatus: 'PENDING' | 'CONFIRMED') => {
    if (!session?.user?.email) return;

    if (!selectedClientId) {
      alert('Debe seleccionar un cliente');
      return;
    }

    if (items.length === 0) {
      alert('Debe agregar al menos un producto o servicio');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = btoa(JSON.stringify({
        email: session.user.email,
        role: session.user.role,
        timestamp: Date.now()
      }));

      const requestBody = {
        clientId: selectedClientId,
        saleDate,
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
          taxAmount: item.taxAmount
        })),
        notes,
        termsAndConditions,
        taxRate: 0.16
      };

      const response = await fetch(`${API_URL}/api/practice-management/ventas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear venta');
      }

      router.push('/dashboard/practice/ventas');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const total = calculateTotal();

  if (status === "loading" || loadingClients || loadingProducts) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <Link
            href="/dashboard/practice/ventas"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Ventas
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-green-600" />
            Nueva Venta
          </h1>
          <p className="text-gray-600 mt-2">Registra una nueva venta en firme</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Selection */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Cliente</h2>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cliente *
                </label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.businessName} {client.contactName ? `- ${client.contactName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xl">✓</span>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{selectedClient.businessName}</div>
                      {selectedClient.contactName && (
                        <div className="text-sm text-gray-600">Contacto: {selectedClient.contactName}</div>
                      )}
                      {selectedClient.email && (
                        <div className="text-sm text-gray-600">📧 {selectedClient.email}</div>
                      )}
                      {selectedClient.phone && (
                        <div className="text-sm text-gray-600">📞 {selectedClient.phone}</div>
                      )}
                      {selectedClient.rfc && (
                        <div className="text-sm text-gray-600">RFC: {selectedClient.rfc}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de venta *
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de entrega
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">(Opcional)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de pago *
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as 'PENDING' | 'PARTIAL' | 'PAID')}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="PARTIAL">Pago Parcial</option>
                    <option value="PAID">Pagada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monto pagado
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total: ${total.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas adicionales
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Añade notas sobre esta venta..."
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Términos y condiciones
                </label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Ej: Pago 50% anticipo, 50% contra entrega..."
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Productos y Servicios</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Producto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomItemType('product');
                    setCustomUnit('pza');
                    setShowCustomItemModal(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Producto Personalizado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomItemType('service');
                    setCustomUnit('servicio');
                    setShowCustomItemModal(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Servicio Personalizado
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No hay productos o servicios agregados</p>
                  <p className="text-sm text-gray-400 mt-1">Haz clic en los botones de arriba para agregar items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Descripción</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cant.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unidad</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">P. Unit.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Desc. %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">IVA %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subtotal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {items.map(item => (
                        <tr key={item.tempId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.description}</div>
                            {item.sku && (
                              <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                            )}
                            {!item.productId && (
                              <div className={`text-xs ${
                                item.itemType === 'product' ? 'text-purple-600' : 'text-blue-600'
                              }`}>
                                {item.itemType === 'product' ? 'Producto personalizado' : 'Servicio personalizado'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.tempId, parseFloat(e.target.value) || 0)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => updateItemPrice(item.tempId, parseFloat(e.target.value) || 0)}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={(item.discountRate * 100).toFixed(2)}
                              onChange={(e) => updateItemDiscount(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <select
                                value={item.taxRate === 0 ? '0' : item.taxRate === 0.16 ? '0.16' : 'custom'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '0') {
                                    updateItemTaxRate(item.tempId, 0);
                                  } else if (val === '0.16') {
                                    updateItemTaxRate(item.tempId, 0.16);
                                  }
                                }}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                              >
                                <option value="0">0%</option>
                                <option value="0.16">16%</option>
                                <option value="custom">Personalizado</option>
                              </select>
                              {(item.taxRate !== 0 && item.taxRate !== 0.16) && (
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={(item.taxRate * 100).toFixed(2)}
                                  onChange={(e) => updateItemTaxRate(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                  placeholder="% IVA"
                                />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            ${item.subtotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeItem(item.tempId)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary (Sticky) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Productos/Servicios</span>
                  <span className="font-semibold text-gray-900">{items.length}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">IVA Total</span>
                  <span className="font-semibold text-gray-900">${tax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-900 font-bold text-lg">TOTAL</span>
                  <span className="font-bold text-green-600 text-xl">${total.toFixed(2)}</span>
                </div>

                {amountPaid > 0 && (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-600">Monto Pagado</span>
                      <span className="font-semibold text-green-600">${amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Saldo Pendiente</span>
                      <span className="font-semibold text-red-600">${(total - amountPaid).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <button
                  onClick={() => handleSubmit('PENDING')}
                  disabled={submitting || !selectedClientId || items.length === 0}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  title={!selectedClientId ? 'Selecciona un cliente' : items.length === 0 ? 'Agrega al menos un producto o servicio' : ''}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Guardando...
                    </div>
                  ) : (
                    'Guardar como Pendiente'
                  )}
                </button>
                <button
                  onClick={() => handleSubmit('CONFIRMED')}
                  disabled={submitting || !selectedClientId || items.length === 0}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
                  title={!selectedClientId ? 'Selecciona un cliente' : items.length === 0 ? 'Agrega al menos un producto o servicio' : ''}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Confirmar Venta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection Modal */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">Seleccionar Producto</h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />

                <div className="overflow-y-auto max-h-96 space-y-2">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addProductToQuote(product)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.sku && (
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">
                          {product.stockQuantity !== null ? `Stock: ${product.stockQuantity} ${product.unit || 'unidades'}` : 'Sin stock registrado'}
                        </span>
                        <span className="font-semibold text-green-600">
                          ${parseFloat(product.price || '0').toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}

                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No se encontraron productos
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Item Modal */}
        {showCustomItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  {customItemType === 'product' ? 'Producto Personalizado' : 'Servicio Personalizado'}
                </h3>
                <button
                  onClick={() => setShowCustomItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción *
                  </label>
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Nombre del producto o servicio"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(parseFloat(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad *
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="pza">Pieza</option>
                      <option value="kg">Kilogramo</option>
                      <option value="lt">Litro</option>
                      <option value="mt">Metro</option>
                      <option value="caja">Caja</option>
                      <option value="servicio">Servicio</option>
                      <option value="hora">Hora</option>
                      <option value="día">Día</option>
                      <option value="sesión">Sesión</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio Unitario *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowCustomItemModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addCustomItemToQuote}
                    disabled={!customDescription || customPrice <= 0}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
