"use client";

import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Package, X, Mic } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/auth-fetch";
import dynamic from 'next/dynamic';
import type { VoiceStructuredData, VoicePurchaseData } from '@/types/voice-assistant';
import type { InitialChatData } from '@/hooks/useChatSession';

// Dynamically import voice assistant components (client-side only)
const VoiceRecordingModal = dynamic(
  () => import('@/components/voice-assistant/VoiceRecordingModal').then(mod => mod.VoiceRecordingModal),
  { ssr: false }
);

const VoiceChatSidebar = dynamic(
  () => import('@/components/voice-assistant/chat/VoiceChatSidebar').then(mod => mod.VoiceChatSidebar),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || '${API_URL}';

interface DoctorProfile {
  id: string;
  slug: string;
  primarySpecialty: string;
}

interface Supplier {
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

interface PurchaseItem {
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
  taxRate2: number;
  taxAmount2: number;
}

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

  // Data loading
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingSuppliers, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  // Fix: Use local date components instead of UTC to avoid timezone shift
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const [purchaseDate, setPurchaseDate] = useState(`${year}-${month}-${day}`);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PARTIAL' | 'PAID'>('PENDING');
  const [amountPaid, setAmountPaid] = useState(0);

  // Items state
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [taxColumnLabel, setTaxColumnLabel] = useState('RTP %');
  const [taxColumnLabel2, setTaxColumnLabel2] = useState('Imp. 2 %');

  // Auto-set amountPaid based on paymentStatus
  useEffect(() => {
    const total = calculateTotal();

    if (paymentStatus === 'PENDING') {
      setAmountPaid(0);
    } else if (paymentStatus === 'PAID') {
      setAmountPaid(total);
    }
    // For PARTIAL, keep current amountPaid value
  }, [paymentStatus]);

  // Update amountPaid when total changes if status is PAID
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      const total = calculateTotal();
      setAmountPaid(total);
    }
  }, [items]); // items change triggers total recalculation

  // Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Voice assistant state
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showVoiceSidebar, setShowVoiceSidebar] = useState(false);
  const [voiceInitialData, setVoiceInitialData] = useState<any>(null);

  // Custom item modal state
  const [customItemType, setCustomItemType] = useState<'product' | 'service'>('service');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnit, setCustomUnit] = useState('servicio');
  const [customPrice, setCustomPrice] = useState(0);

  useEffect(() => {
    if (session?.user?.doctorId) {
      fetchDoctorProfile(session.user.doctorId);
    }
    fetchSuppliers();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [searchParams, suppliers]);

  const fetchDoctorProfile = async (doctorId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/doctors`);
      const result = await response.json();

      if (result.success) {
        const doctor = result.data.find((d: any) => d.id === doctorId);
        if (doctor) {
          setDoctorProfile(doctor);
        }
      }
    } catch (err) {
      console.error("Error fetching doctor profile:", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/proveedores?status=active`);

      if (!response.ok) throw new Error('Error al cargar proveedores');
      const result = await response.json();
      setSuppliers(result.data || []);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/products?status=active`);

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

    const newItem: PurchaseItem = {
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
      taxRate2: 0,
      taxAmount2: 0,
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

    const newItem: PurchaseItem = {
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
      taxRate2: 0,
      taxAmount2: 0,
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
        const taxAmount2 = subtotal * item.taxRate2;
        return { ...item, quantity, subtotal, taxAmount, taxAmount2 };
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
        const taxAmount2 = subtotal * item.taxRate2;
        return { ...item, unitPrice, subtotal, taxAmount, taxAmount2 };
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
        const taxAmount2 = subtotal * item.taxRate2;
        return { ...item, discountRate, subtotal, taxAmount, taxAmount2 };
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

  const updateItemTaxRate2 = (tempId: string, taxRate2: number) => {
    setItems(items.map(item => {
      if (item.tempId === tempId) {
        const taxAmount2 = item.subtotal * taxRate2;
        return { ...item, taxRate2, taxAmount2 };
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

  const calculateTax2 = () => {
    return items.reduce((sum, item) => sum + item.taxAmount2, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const tax2 = calculateTax2();
    return subtotal + tax + tax2;
  };

  const handleVoiceModalComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const purchaseData = data as VoicePurchaseData;

    // Calculate extracted fields
    const allFields = Object.keys(purchaseData);
    const extracted = allFields.filter(
      k => purchaseData[k as keyof VoicePurchaseData] != null &&
           purchaseData[k as keyof VoicePurchaseData] !== '' &&
           !(Array.isArray(purchaseData[k as keyof VoicePurchaseData]) &&
             (purchaseData[k as keyof VoicePurchaseData] as any[]).length === 0)
    );

    // Prepare initial data for sidebar
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

    console.log('[Compras New] Voice data confirmed:', purchaseData);

    // 1. Set supplier if supplierName is provided (attempt fuzzy matching)
    if (purchaseData.supplierName) {
      const matchedSupplier = suppliers.find(
        (s) =>
          s.businessName.toLowerCase().includes(purchaseData.supplierName!.toLowerCase()) ||
          s.contactName?.toLowerCase().includes(purchaseData.supplierName!.toLowerCase())
      );
      if (matchedSupplier) {
        setSelectedSupplierId(matchedSupplier.id);
        console.log('[Compras New] Matched supplier:', matchedSupplier.businessName);
      } else {
        console.log('[Compras New] No supplier match found for:', purchaseData.supplierName);
      }
    }

    // 2. Set dates
    if (purchaseData.purchaseDate) {
      setPurchaseDate(purchaseData.purchaseDate);
    }
    if (purchaseData.deliveryDate) {
      setDeliveryDate(purchaseData.deliveryDate);
    }

    // 3. Set payment status and amount
    if (purchaseData.paymentStatus) {
      setPaymentStatus(purchaseData.paymentStatus);
    }
    if (purchaseData.amountPaid !== null && purchaseData.amountPaid !== undefined) {
      setAmountPaid(purchaseData.amountPaid);
    }

    // 4. Set notes and terms
    if (purchaseData.notes) {
      setNotes(purchaseData.notes);
    }
    if (purchaseData.termsAndConditions) {
      setTermsAndConditions(purchaseData.termsAndConditions);
    }

    // 5. Map items to form state
    if (purchaseData.items && purchaseData.items.length > 0) {
      const mappedItems: PurchaseItem[] = purchaseData.items.map((voiceItem, index) => {
        // Try to match to existing product
        let matchedProduct: Product | undefined;
        if (voiceItem.productName) {
          matchedProduct = products.find(
            (p) =>
              p.name.toLowerCase().includes(voiceItem.productName!.toLowerCase()) ||
              p.sku?.toLowerCase().includes(voiceItem.productName!.toLowerCase())
          );
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
      });

      setItems(mappedItems);
      console.log('[Compras New] Mapped items:', mappedItems.length);
    }

    // Close voice sidebar
    setShowVoiceSidebar(false);
  };

  const handleSubmit = async (saveStatus: 'PENDING' | 'CONFIRMED') => {
    if (!selectedSupplierId) {
      alert('Debe seleccionar un proveedor');
      return;
    }

    if (items.length === 0) {
      alert('Debe agregar al menos un producto o servicio');
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
          taxAmount2: item.taxAmount2
        })),
        notes,
        termsAndConditions,
        taxRate: 0.16
      };

      const response = await authFetch(`${API_URL}/api/practice-management/compras`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
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
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const tax2 = calculateTax2();
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
            <button
              onClick={() => setShowVoiceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              title="Asistente de Voz"
            >
              <Mic className="w-4 h-4" />
              Asistente de Voz
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Compra</h1>
          <p className="text-gray-600 mt-1">Registra una nueva compra</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Client & Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Información del Proveedor</h2>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proveedor *
                </label>
                <select
                  value={selectedSupplierId || ''}
                  onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar proveedor...</option>
                  {suppliers.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.businessName} {client.contactName ? `- ${client.contactName}` : ''}
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de compra *
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      $
                    </span>
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Productos y Servicios</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors"
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
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-md transition-colors"
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
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Servicio Personalizado
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No hay productos o servicios agregados</p>
                  <p className="text-sm text-gray-400 mt-1">Haz clic en los botones de arriba para agregar items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cant.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidad</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P. Unit.</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desc. %</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                          <input
                            type="text"
                            value={taxColumnLabel}
                            onChange={(e) => setTaxColumnLabel(e.target.value)}
                            className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                            placeholder="RTP %"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                          <input
                            type="text"
                            value={taxColumnLabel2}
                            onChange={(e) => setTaxColumnLabel2(e.target.value)}
                            className="w-24 text-xs font-medium text-blue-600 uppercase bg-blue-50 border border-dashed border-blue-300 rounded px-1 py-0.5 focus:border-blue-500 focus:bg-blue-100 focus:outline-none cursor-text"
                            placeholder="Imp. 2 %"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acción</th>
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
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={(item.taxRate * 100).toFixed(2)}
                              onChange={(e) => updateItemTaxRate(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={(item.taxRate2 * 100).toFixed(2)}
                              onChange={(e) => updateItemTaxRate2(item.tempId, parseFloat(e.target.value) / 100 || 0)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                              placeholder="0"
                            />
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
                  placeholder="Añade notas sobre esta compra..."
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
                  placeholder="Ej: Pago 50% anticipo, 50% contra entrega..."
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
                  <span className="text-gray-600">Productos/Servicios</span>
                  <span className="font-semibold text-gray-900">{items.length}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-gray-600">{taxColumnLabel || 'RTP %'} Total</span>
                  <span className="font-semibold text-gray-900">${tax.toFixed(2)}</span>
                </div>

                {tax2 > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-gray-600">{taxColumnLabel2 || 'Imp. 2 %'} Total</span>
                    <span className="font-semibold text-gray-900">${tax2.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-900 font-bold text-lg">TOTAL</span>
                  <span className="font-bold text-blue-600 text-xl">${total.toFixed(2)}</span>
                </div>

                {amountPaid > 0 && (
                  <>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-gray-600">Monto Pagado</span>
                      <span className="font-semibold text-blue-600">${amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Saldo Pendiente</span>
                      <span className="font-semibold text-red-600">${(total - amountPaid).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleSubmit('PENDING')}
                  disabled={submitting || !selectedSupplierId || items.length === 0}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  title={!selectedSupplierId ? 'Selecciona un proveedor' : items.length === 0 ? 'Agrega al menos un producto o servicio' : ''}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Guardar Compra
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
            <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">Seleccionar Producto</h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />

                <div className="overflow-y-auto max-h-96 space-y-2">
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addProductToQuote(product)}
                      className="w-full text-left p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      {product.sku && (
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-gray-600">
                          {product.stockQuantity !== null ? `Stock: ${product.stockQuantity} ${product.unit || 'unidades'}` : 'Sin stock registrado'}
                        </span>
                        <span className="font-semibold text-blue-600">
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
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900">
                  {customItemType === 'product' ? 'Producto Personalizado' : 'Servicio Personalizado'}
                </h3>
                <button
                  onClick={() => setShowCustomItemModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unidad *
                    </label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setShowCustomItemModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addCustomItemToQuote}
                    disabled={!customDescription || customPrice <= 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>
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
          patientId="purchase" // Use a special ID for purchase context
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
