"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";

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
  type: 'product' | 'service';
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

export default function EditVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/login");
    },
  });

  const router = useRouter();
  const [saleId, setSaleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data loading
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSale, setLoadingSale] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  // Fix: Use local date components instead of UTC to avoid timezone shift
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const [saleDate, setSaleDate] = useState(`${year}-${month}-${day}`);
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
  const [productTypeFilter, setProductTypeFilter] = useState<'product' | 'service' | null>(null);

  // Custom item modal state
  const [customItemType, setCustomItemType] = useState<'product' | 'service'>('service');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnit, setCustomUnit] = useState('servicio');
  const [customPrice, setCustomPrice] = useState(0);

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      setSaleId(resolvedParams.id);
    };
    loadParams();
  }, [params]);

  useEffect(() => {
    if (session?.user?.email && saleId) {
      fetchClients();
      fetchProducts();
      fetchSale();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  const fetchSale = async () => {
    if (!saleId) return;

    setLoadingSale(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
      });

      if (!response.ok) throw new Error('Error al cargar venta');
      const result = await response.json();
      const sale = result.data;

      // Pre-populate form fields
      setSelectedClientId(sale.client.id);
      setSaleDate(sale.saleDate.split('T')[0]);
      setDeliveryDate(sale.deliveryDate ? sale.deliveryDate.split('T')[0] : '');
      setNotes(sale.notes || '');
      setTermsAndConditions(sale.termsAndConditions || '');
      setPaymentStatus(sale.paymentStatus);
      setAmountPaid(parseFloat(sale.amountPaid || 0));

      // Convert database items to SaleItem format
      const convertedItems: SaleItem[] = sale.items.map((item: any) => ({
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
        taxAmount: parseFloat(item.taxAmount)
      }));
      setItems(convertedItems);
    } catch (err) {
      console.error('Error al cargar venta:', err);
      setError('Error al cargar la venta');
    } finally {
      setLoadingSale(false);
    }
  };

  const fetchClients = async () => {

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/clients?status=active`, {
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

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/products?status=active`, {
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
    if (!saleId) return;

    if (!selectedClientId) {
      alert('Debe seleccionar un paciente');
      return;
    }

    if (items.length === 0) {
      alert('Debe agregar al menos un servicio');
      return;
    }

    if (!session) return;

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

      const response = await authFetch(`${API_URL}/api/practice-management/ventas/${saleId}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar venta');
      }

      router.push(`/dashboard/practice/ventas/${saleId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase());
    const matchesType = productTypeFilter ? p.type === productTypeFilter : true;
    return matchesSearch && matchesType;
  });

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const total = calculateTotal();
  const balance = total - amountPaid;

  if (status === "loading" || loadingClients || loadingProducts || loadingSale) {
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
            href={`/dashboard/practice/ventas/${saleId}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
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
          {/* Left Column - Client & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Patient Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Paciente</h2>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paciente *
                </label>
                <select
                  value={selectedClientId || ''}
                  onChange={(e) => setSelectedClientId(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar paciente...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.businessName} {client.contactName ? `- ${client.contactName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 text-xl">✓</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha del servicio *
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado de pago *
                  </label>
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
                    Monto pagado
                  </label>
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Servicios</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setProductTypeFilter('service');
                    setProductSearch('');
                    setShowProductModal(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Agregar Servicio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProductTypeFilter('product');
                    setProductSearch('');
                    setShowProductModal(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300"
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
                  className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-300"
                >
                  <Plus className="w-5 h-5" />
                  Producto o Servicio Personalizado
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No hay servicios agregados</p>
                  <p className="text-sm text-gray-400 mt-1">Haz clic en "Agregar Servicio" para comenzar</p>
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

            {/* Notes and Terms Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notas y Términos</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas adicionales
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Añade notas sobre esta venta..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Términos y condiciones
                </label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Ej: Garantía de 30 días, devoluciones aceptadas..."
                />
              </div>
            </div>
          </div>

          {/* Right Column - Summary (Sticky) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Servicios</span>
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

                <div className="flex justify-between items-center pt-2 pb-3 border-b">
                  <span className="text-gray-900 font-bold text-lg">TOTAL</span>
                  <span className="font-bold text-blue-600 text-xl">${total.toFixed(2)}</span>
                </div>

                {amountPaid > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Pagado</span>
                      <span className="font-semibold text-green-600">${amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-900 font-bold">Saldo</span>
                      <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ${balance.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleSubmit('PENDING')}
                  disabled={submitting || !selectedClientId || items.length === 0}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
                  title={!selectedClientId ? 'Selecciona un paciente' : items.length === 0 ? 'Agrega al menos un servicio' : ''}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Actualizar Venta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Selection Modal - Same as cotizaciones */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {productTypeFilter === 'service' ? 'Seleccionar Servicio' : 'Seleccionar Producto'}
                </h3>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    setProductSearch('');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 border-b">
                <input
                  type="text"
                  placeholder={productTypeFilter === 'service' ? 'Buscar servicio por nombre...' : 'Buscar producto por nombre o SKU...'}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto max-h-96 p-6">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {productTypeFilter === 'service'
                      ? 'No se encontraron servicios. Crea uno en Productos y Servicios.'
                      : 'No se encontraron productos'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProducts.map(product => (
                      <div
                        key={product.id}
                        onClick={() => addProductToQuote(product)}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-500 cursor-pointer transition-all"
                      >
                        <div className="font-semibold text-gray-900">{product.name}</div>
                        {product.sku && (
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                        )}
                        {product.description && (
                          <div className="text-sm text-gray-600 mt-1">{product.description}</div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-blue-600">
                            ${parseFloat(product.price || '0').toFixed(2)} {product.unit && `/ ${product.unit}`}
                          </span>
                          {product.stockQuantity !== null && (
                            <span className="text-sm text-gray-500">
                              Stock: {product.stockQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom Item Modal - Same as cotizaciones */}
        {showCustomItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
              <div className={`p-6 border-b flex justify-between items-center ${
                customItemType === 'product' ? 'bg-purple-50' : 'bg-blue-50'
              }`}>
                <h3 className="text-xl font-bold text-gray-900">
                  {customItemType === 'product' ? 'Producto Personalizado' : 'Servicio Personalizado'}
                </h3>
                <button
                  onClick={() => setShowCustomItemModal(false)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción {customItemType === 'product' ? 'del producto' : 'del servicio'} *
                  </label>
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder={customItemType === 'product'
                      ? "Ej: Producto especial, Item único, etc."
                      : "Ej: Consulta especializada, Instalación, etc."}
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
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad *
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      {customItemType === 'product' ? (
                        <>
                          <option value="pza">pza</option>
                          <option value="kg">kg</option>
                          <option value="lt">lt</option>
                          <option value="mt">mt</option>
                          <option value="caja">caja</option>
                          <option value="paquete">paquete</option>
                        </>
                      ) : (
                        <>
                          <option value="servicio">servicio</option>
                          <option value="hora">hora</option>
                          <option value="día">día</option>
                          <option value="sesión">sesión</option>
                          <option value="consulta">consulta</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio unitario *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-xl font-bold text-gray-900">
                      ${(customQuantity * customPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCustomItemModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addCustomItemToQuote}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                      customItemType === 'product'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    Agregar {customItemType === 'product' ? 'Producto' : 'Servicio'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
