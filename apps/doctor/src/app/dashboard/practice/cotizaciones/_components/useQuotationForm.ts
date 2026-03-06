'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type { Client, Patient, Product, QuotationItem } from './quotation-types';
import { toast } from '@/lib/practice-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useQuotationForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [resolvingPatient, setResolvingPatient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  const [items, setItems] = useState<QuotationItem[]>([]);
  const [taxColumnLabel, setTaxColumnLabel] = useState('RTP %');
  const [taxColumnLabel2, setTaxColumnLabel2] = useState('Imp. 2 %');

  const [showProductModal, setShowProductModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<'product' | 'service' | null>(null);

  const [customItemType, setCustomItemType] = useState<'product' | 'service'>('service');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customUnit, setCustomUnit] = useState('servicio');
  const [customPrice, setCustomPrice] = useState(0);

  const fetchClients = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/clients?status=active`);
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

  const fetchPatients = async () => {
    try {
      const response = await fetch('/api/medical-records/patients?status=active');
      if (!response.ok) throw new Error('Error al cargar pacientes');
      const data = await response.json();
      setPatients(data.data || []);
    } catch (err) {
      console.error('Error al cargar pacientes:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const resolvePatientAsClient = async (patient: Patient) => {
    setResolvingPatient(true);
    const fullName = `${patient.firstName} ${patient.lastName}`;

    const existing = clients.find(c => c.businessName === fullName);
    if (existing) {
      setSelectedClientId(existing.id);
      setResolvingPatient(false);
      return;
    }

    try {
      const response = await authFetch(`${API_URL}/api/practice-management/clients`, {
        method: 'POST',
        body: JSON.stringify({
          businessName: fullName,
          contactName: fullName,
          email: patient.email || null,
          phone: patient.phone || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setClients(prev => [...prev, result.data]);
        setSelectedClientId(result.data.id);
      } else if (response.status === 409) {
        const refreshResponse = await authFetch(`${API_URL}/api/practice-management/clients?status=active`);
        const refreshResult = await refreshResponse.json();
        const refreshedClients: Client[] = refreshResult.data || [];
        setClients(refreshedClients);
        const found = refreshedClients.find(c => c.businessName === fullName);
        if (found) setSelectedClientId(found.id);
      }
    } catch (err) {
      console.error('Error al crear cliente desde paciente:', err);
    } finally {
      setResolvingPatient(false);
    }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedClientId(null);
      setSelectedPatient(null);
      return;
    }

    if (value.startsWith('patient:')) {
      const patientId = value.slice('patient:'.length);
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        setSelectedPatient(patient);
        resolvePatientAsClient(patient);
      }
    } else {
      const clientId = Number(value.slice('client:'.length));
      setSelectedClientId(clientId);
      setSelectedPatient(null);
    }
  };

  const addProductToQuote = (product: Product) => {
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
      subtotal,
      taxRate,
      taxAmount: subtotal * taxRate,
      taxRate2: 0,
      taxAmount2: 0,
    }]);
    setShowProductModal(false);
    setProductSearch('');
  };

  const addCustomItemToQuote = () => {
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
      subtotal,
      taxRate,
      taxAmount: subtotal * taxRate,
      taxRate2: 0,
      taxAmount2: 0,
    }]);
    setShowCustomItemModal(false);
    setCustomDescription('');
    setCustomQuantity(1);
    setCustomUnit('servicio');
    setCustomPrice(0);
    setCustomItemType('service');
  };

  const removeItem = (tempId: string) => {
    setItems(prev => prev.filter(item => item.tempId !== tempId));
  };

  const updateItemQuantity = (tempId: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const baseAmount = quantity * item.unitPrice;
      const discountAmount = baseAmount * item.discountRate;
      const subtotal = baseAmount - discountAmount;
      return { ...item, quantity, subtotal, taxAmount: subtotal * item.taxRate, taxAmount2: subtotal * item.taxRate2 };
    }));
  };

  const updateItemPrice = (tempId: string, unitPrice: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const baseAmount = item.quantity * unitPrice;
      const discountAmount = baseAmount * item.discountRate;
      const subtotal = baseAmount - discountAmount;
      return { ...item, unitPrice, subtotal, taxAmount: subtotal * item.taxRate, taxAmount2: subtotal * item.taxRate2 };
    }));
  };

  const updateItemDiscount = (tempId: string, discountRate: number) => {
    setItems(prev => prev.map(item => {
      if (item.tempId !== tempId) return item;
      const baseAmount = item.quantity * item.unitPrice;
      const discountAmount = baseAmount * discountRate;
      const subtotal = baseAmount - discountAmount;
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

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.subtotal, 0);
  const calculateTax = () => items.reduce((sum, item) => sum + item.taxAmount, 0);
  const calculateTax2 = () => items.reduce((sum, item) => sum + item.taxAmount2, 0);
  const calculateTotal = () => calculateSubtotal() + calculateTax() + calculateTax2();

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectValue = selectedPatient
    ? `patient:${selectedPatient.id}`
    : selectedClientId
      ? `client:${selectedClientId}`
      : '';
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase());
    const matchesType = productTypeFilter ? p.type === productTypeFilter : true;
    return matchesSearch && matchesType;
  });

  return {
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
  };
}
