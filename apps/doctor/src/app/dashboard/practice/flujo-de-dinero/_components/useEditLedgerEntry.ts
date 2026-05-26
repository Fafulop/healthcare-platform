'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { uploadFiles } from '@/lib/uploadthing';
import { toast } from '@/lib/practice-toast';
import type { Area, LedgerEntry } from './ledger-types';
import type { Attachment, Factura, FacturaXml } from './useLedgerDetail';

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

  // File upload state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [facturasXml, setFacturasXml] = useState<FacturaXml[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'attachment' | 'factura' | 'xml' | null>(null);

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
      setAttachments(e.attachments || []);
      setFacturas(e.facturas || []);
      setFacturasXml(e.facturasXml || []);

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

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'attachment' | 'factura' | 'xml'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadType(type);
    setUploading(true);
    try {
      let uploadEndpoint: 'ledgerAttachments' | 'ledgerFacturasPdf' | 'ledgerFacturasXml';
      if (type === 'attachment') uploadEndpoint = 'ledgerAttachments';
      else if (type === 'factura') uploadEndpoint = 'ledgerFacturasPdf';
      else uploadEndpoint = 'ledgerFacturasXml';

      const uploadResult = await uploadFiles(uploadEndpoint, { files: [file] });
      if (!uploadResult || uploadResult.length === 0) throw new Error('Error al subir archivo');

      const uploadedFile = uploadResult[0];
      const metadata: Record<string, unknown> = {
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
        fileType: file.type,
      };

      if (type === 'xml') {
        metadata.xmlContent = await file.text();
      }

      let apiEndpoint = '';
      if (type === 'attachment') apiEndpoint = `/api/practice-management/ledger/${entryId}/attachments`;
      if (type === 'factura') apiEndpoint = `/api/practice-management/ledger/${entryId}/facturas`;
      if (type === 'xml') apiEndpoint = `/api/practice-management/ledger/${entryId}/facturas-xml`;

      const response = await authFetch(`${API_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar archivo');
      }

      // Re-fetch to get updated attachments
      await fetchEntry();
      toast.success('Archivo subido correctamente');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
      setUploadType(null);
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
    attachments,
    facturas,
    facturasXml,
    uploading,
    uploadType,
    handleChange,
    handleSubmit,
    handleFileUpload,
  };
}
