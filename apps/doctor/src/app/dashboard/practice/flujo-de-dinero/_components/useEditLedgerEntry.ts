'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import type { Area, LedgerEntry } from './ledger-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface EditFormData {
  entryType: 'ingreso' | 'egreso';
  amount: string;
  concept: string;
  transactionDate: string;
  area: string;
  subarea: string;
  bankAccount: string;
  formaDePago: string;
  bankMovementId: string;
  internalId: string;
  porRealizar: boolean;
  paymentOption: 'paid' | 'pending';
}

export function useEditLedgerEntry() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const entryId = params.id as string;

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [entry, setEntry] = useState<LedgerEntry | null>(null);

  const [formData, setFormData] = useState<EditFormData>({
    entryType: 'ingreso',
    amount: '',
    concept: '',
    transactionDate: '',
    area: '',
    subarea: '',
    bankAccount: '',
    formaDePago: 'efectivo',
    bankMovementId: '',
    internalId: '',
    porRealizar: false,
    paymentOption: 'paid',
  });

  useEffect(() => {
    if (session?.user?.email) {
      fetchAreas();
      fetchEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/areas`);
      if (!response.ok) throw new Error('Error al cargar áreas');
      const result = await response.json();
      setAreas(result.data || []);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    }
  };

  const fetchEntry = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`);
      if (!response.ok) throw new Error('Error al cargar movimiento');
      const result = await response.json();
      const e = result.data;
      setEntry(e);

      const amount = parseFloat(e.amount);
      const amountPaid = parseFloat(e.amountPaid || '0');
      const paymentOption: 'paid' | 'pending' = amountPaid >= amount ? 'paid' : 'pending';

      setFormData({
        entryType: e.entryType,
        amount: e.amount,
        concept: e.concept,
        transactionDate: e.transactionDate.split('T')[0],
        area: e.area,
        subarea: e.subarea,
        bankAccount: e.bankAccount || '',
        formaDePago: e.formaDePago,
        bankMovementId: e.bankMovementId || '',
        internalId: e.internalId,
        porRealizar: e.porRealizar,
        paymentOption,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    if (name === 'area') {
      setFormData(prev => ({ ...prev, subarea: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    if (!formData.concept.trim()) {
      setError('El concepto es requerido');
      return;
    }
    if (!formData.area || !formData.subarea) {
      setError('Seleccione un área y subárea');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const amount = parseFloat(formData.amount);
      const amountPaid = formData.paymentOption === 'paid' ? amount : 0;
      const paymentStatus = formData.paymentOption === 'paid' ? 'PAID' : 'PENDING';

      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, amount, amountPaid, paymentStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar movimiento');
      }

      router.push('/dashboard/practice/flujo-de-dinero');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAreas = areas.filter(a =>
    formData.entryType === 'ingreso' ? a.type === 'INGRESO' : a.type === 'EGRESO'
  );
  const selectedArea = filteredAreas.find(a => a.name === formData.area);
  const availableSubareas = selectedArea?.subareas || [];

  return {
    entry,
    loading,
    error,
    submitting,
    formData,
    filteredAreas,
    availableSubareas,
    handleChange,
    handleSubmit,
  };
}
