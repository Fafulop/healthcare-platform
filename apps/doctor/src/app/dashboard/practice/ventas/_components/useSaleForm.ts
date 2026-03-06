'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type { Client, Product, SaleItem } from './sale-types';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function useSaleForm() {
  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [saleDate, setSaleDate] = useState(todayString());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PARTIAL' | 'PAID'>('PENDING');
  const [amountPaid, setAmountPaid] = useState(0);

  // Items
  const [items, setItems] = useState<SaleItem[]>([]);
  const [taxColumnLabel, setTaxColumnLabel] = useState('RTP %');
  const [taxColumnLabel2, setTaxColumnLabel2] = useState('Imp. 2 %');

  // Modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<'product' | 'service' | null>(null);
  const [customItemType, setCustomItemType] = useState<'product' | 'service'>('service');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnit, setCustomUnit] = useState('servicio');
  const [customPrice, setCustomPrice] = useState(0);

  // Auto-set amountPaid based on paymentStatus
  useEffect(() => {
    if (paymentStatus === 'PENDING') setAmountPaid(0);
    else if (paymentStatus === 'PAID') setAmountPaid(calculateTotal());
    // PARTIAL: keep current value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus]);

  // Keep amountPaid in sync when PAID and items change
  useEffect(() => {
    if (paymentStatus === 'PAID') setAmountPaid(calculateTotal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Fetch helpers
  const fetchClients = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/clients?status=active`);
      if (!res.ok) throw new Error('Error al cargar clientes');
      const result = await res.json();
      setClients(result.data || []);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/products?status=active`);
      if (!res.ok) throw new Error('Error al cargar productos');
      const result = await res.json();
      setProducts(result.data || []);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Item management
  const addProductToSale = (product: Product) => {
    const unitPrice = parseFloat(product.price || '0');
    const subtotal = unitPrice;
    const taxRate = 0.16;
    setItems(prev => [...prev, {
      tempId: `temp-${Date.now()}`,
      productId: product.id,
      itemType: 'product',
      description: product.name,
      sku: product.sku,
      quantity: 1,
      unit: product.unit || 'pza',
      unitPrice,
      discountRate: 0,
      taxRate,
      taxAmount: subtotal * taxRate,
      taxRate2: 0,
      taxAmount2: 0,
      subtotal,
    }]);
    setShowProductModal(false);
    setProductSearch('');
  };

  const addCustomItemToSale = () => {
    if (!customDescription || customPrice <= 0) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    const subtotal = customQuantity * customPrice;
    const taxRate = 0.16;
    setItems(prev => [...prev, {
      tempId: `temp-${Date.now()}`,
      productId: null,
      itemType: customItemType,
      description: customDescription,
      sku: null,
      quantity: customQuantity,
      unit: customUnit,
      unitPrice: customPrice,
      discountRate: 0,
      taxRate,
      taxAmount: subtotal * taxRate,
      taxRate2: 0,
      taxAmount2: 0,
      subtotal,
    }]);
    setShowCustomItemModal(false);
    setCustomDescription('');
    setCustomQuantity(1);
    setCustomUnit('servicio');
    setCustomPrice(0);
    setCustomItemType('service');
  };

  const removeItem = (tempId: string) => {
    setItems(prev => prev.filter(i => i.tempId !== tempId));
  };

  const updateItemQuantity = (tempId: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const base = quantity * item.unitPrice;
      const discount = base * item.discountRate;
      const subtotal = base - discount;
      return { ...item, quantity, subtotal, taxAmount: subtotal * item.taxRate, taxAmount2: subtotal * item.taxRate2 };
    }));
  };

  const updateItemPrice = (tempId: string, unitPrice: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const base = item.quantity * unitPrice;
      const discount = base * item.discountRate;
      const subtotal = base - discount;
      return { ...item, unitPrice, subtotal, taxAmount: subtotal * item.taxRate, taxAmount2: subtotal * item.taxRate2 };
    }));
  };

  const updateItemDiscount = (tempId: string, discountRate: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const base = item.quantity * item.unitPrice;
      const subtotal = base - base * discountRate;
      return { ...item, discountRate, subtotal, taxAmount: subtotal * item.taxRate, taxAmount2: subtotal * item.taxRate2 };
    }));
  };

  const updateItemTaxRate = (tempId: string, taxRate: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      return { ...item, taxRate, taxAmount: item.subtotal * taxRate };
    }));
  };

  const updateItemTaxRate2 = (tempId: string, taxRate2: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      return { ...item, taxRate2, taxAmount2: item.subtotal * taxRate2 };
    }));
  };

  // Totals
  const calculateSubtotal = () => items.reduce((s, i) => s + i.subtotal, 0);
  const calculateTax = () => items.reduce((s, i) => s + i.taxAmount, 0);
  const calculateTax2 = () => items.reduce((s, i) => s + i.taxAmount2, 0);
  const calculateTotal = () => calculateSubtotal() + calculateTax() + calculateTax2();

  // Derived
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase());
    const matchType = productTypeFilter ? p.type === productTypeFilter : true;
    return matchSearch && matchType;
  });

  return {
    // Data
    clients, setClients, products, loadingClients, loadingProducts,
    fetchClients, fetchProducts,
    // Form
    selectedClientId, setSelectedClientId,
    saleDate, setSaleDate,
    deliveryDate, setDeliveryDate,
    notes, setNotes,
    termsAndConditions, setTermsAndConditions,
    paymentStatus, setPaymentStatus,
    amountPaid, setAmountPaid,
    // Items
    items, setItems,
    taxColumnLabel, setTaxColumnLabel,
    taxColumnLabel2, setTaxColumnLabel2,
    addProductToSale, addCustomItemToSale,
    removeItem, updateItemQuantity, updateItemPrice,
    updateItemDiscount, updateItemTaxRate, updateItemTaxRate2,
    // Modal
    showProductModal, setShowProductModal,
    showCustomItemModal, setShowCustomItemModal,
    productSearch, setProductSearch,
    productTypeFilter, setProductTypeFilter,
    customItemType, setCustomItemType,
    customDescription, setCustomDescription,
    customQuantity, setCustomQuantity,
    customUnit, setCustomUnit,
    customPrice, setCustomPrice,
    // Derived
    filteredProducts,
    calculateSubtotal, calculateTax, calculateTax2, calculateTotal,
  };
}
