'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { uploadFiles } from '@/lib/uploadthing';
import { toast } from '@/lib/practice-toast';
import type { InitialChatData } from '@/hooks/useChatSession';
import type { VoiceStructuredData, VoiceLedgerEntryData, VoiceLedgerEntryBatch } from '@/types/voice-assistant';
import type { LedgerEntryData } from '@/hooks/useLedgerChat';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Area {
  id: number;
  name: string;
  type: 'INGRESO' | 'EGRESO';
  subareas: Subarea[];
}

export interface Subarea {
  id: number;
  name: string;
}

export interface ServiceOption {
  id: string;
  serviceName: string;
  price: number | null;
}

export function useNewLedgerEntry() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [services, setServices] = useState<ServiceOption[]>([]);

  const [formData, setFormData] = useState({
    entryType: 'ingreso' as 'ingreso' | 'egreso',
    amount: '',
    concept: '',
    transactionDate: (() => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    area: '',
    subarea: '',
    bankAccount: '',
    formaDePago: 'efectivo',
    bankMovementId: '',
    porRealizar: false,
    paymentOption: 'paid' as 'paid' | 'pending',
    serviceId: '',
  });

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [accumulatedEntries, setAccumulatedEntries] = useState<LedgerEntryData[]>([]);

  // Pending file uploads
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: 'attachment' | 'factura' | 'xml' }[]>([]);

  useEffect(() => {
    if (searchParams.get('chat') === 'true') {
      setChatPanelOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/areas`);
      if (!response.ok) throw new Error('Error al cargar áreas');
      const result = await response.json();
      setAreas(result.data || []);
      // Services come from the same endpoint
      const svcList = (result.services || []).map((s: any) => ({
        id: s.id,
        serviceName: s.serviceName,
        price: s.price ? Number(s.price) : null,
      }));
      setServices(svcList);
    } catch (err) {
      console.error('Error al cargar áreas:', err);
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleBatchEntryCreation = async (entries: VoiceLedgerEntryData[]) => {
    setSubmitting(true);
    setError(null);
    try {
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        try {
          const entryAmount = entry.amount || 0;
          const isPending = entry.paymentStatus === 'PENDING';
          const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...entry,
              amount: entryAmount,
              amountPaid: isPending ? (entry.amountPaid ?? 0) : entryAmount,
              paymentStatus: entry.paymentStatus || 'PAID',
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            errors.push(`Movimiento ${i + 1}: ${errorData.error || 'Error'}`);
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push(`Movimiento ${i + 1}: ${err.message}`);
        }
      }

      setVoiceSidebarOpen(false);
      setSidebarInitialData(undefined);

      if (successCount === entries.length) {
        router.push('/dashboard/practice/flujo-de-dinero?success=batch&count=' + successCount);
      } else if (successCount > 0) {
        setError(`Se crearon ${successCount} de ${entries.length} movimientos. Errores: ${errors.join(', ')}`);
      } else {
        setError(`No se pudo crear ningún movimiento: ${errors.join(', ')}`);
      }
    } catch (err: any) {
      setError('Error al crear movimientos: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoiceModalComplete = (
    transcript: string,
    data: VoiceStructuredData,
    sessionId: string,
    transcriptId: string,
    audioDuration: number
  ) => {
    const ledgerData = data as VoiceLedgerEntryData;
    const allFields = Object.keys(ledgerData);
    const extracted = allFields.filter(k => {
      const val = ledgerData[k as keyof VoiceLedgerEntryData];
      return val != null && val !== '' && !(Array.isArray(val) && val.length === 0);
    });
    const initialData: InitialChatData = {
      transcript,
      structuredData: data,
      sessionId,
      transcriptId,
      audioDuration,
      fieldsExtracted: extracted,
    };
    setSidebarInitialData(initialData);
    setVoiceModalOpen(false);
    setVoiceSidebarOpen(true);
  };

  const handleVoiceConfirm = async (data: VoiceStructuredData) => {
    const batchData = data as VoiceLedgerEntryBatch;
    if (batchData.isBatch && batchData.entries) {
      await handleBatchEntryCreation(batchData.entries);
      return;
    }
    const ledgerData = data as VoiceLedgerEntryData;
    setAccumulatedEntries(prev => [...prev, {
      entryType: ledgerData.entryType || null,
      amount: ledgerData.amount ?? null,
      concept: ledgerData.concept || null,
      transactionDate: ledgerData.transactionDate || null,
      area: ledgerData.area || null,
      subarea: ledgerData.subarea || null,
      bankAccount: ledgerData.bankAccount || null,
      formaDePago: ledgerData.formaDePago || null,
      bankMovementId: ledgerData.bankMovementId || null,
      paymentOption: ledgerData.paymentStatus === 'PENDING' ? 'pending' : ledgerData.paymentStatus === 'PAID' ? 'paid' : null,
    }]);
    setVoiceSidebarOpen(false);
    setSidebarInitialData(undefined);
  };

  useEffect(() => {
    if (searchParams.get('voice') === 'true') {
      const stored = sessionStorage.getItem('voiceLedgerData');
      if (stored) {
        try {
          const { data } = JSON.parse(stored);
          sessionStorage.removeItem('voiceLedgerData');
          handleVoiceConfirm(data);
        } catch (e) {
          console.error('Error parsing voice ledger data:', e);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleChatEntryUpdates = useCallback((entries: LedgerEntryData[]) => {
    setAccumulatedEntries(entries);
  }, []);

  const handleChatBatchCreate = useCallback(async () => {
    if (accumulatedEntries.length === 0) return;
    const mapped: VoiceLedgerEntryData[] = accumulatedEntries.map(e => ({
      entryType: (e.entryType as 'ingreso' | 'egreso') || undefined,
      amount: e.amount ?? undefined,
      concept: e.concept || undefined,
      transactionDate: e.transactionDate || undefined,
      area: e.area || undefined,
      subarea: e.subarea || undefined,
      bankAccount: e.bankAccount || undefined,
      formaDePago: (e.formaDePago as VoiceLedgerEntryData['formaDePago']) || undefined,
      bankMovementId: e.bankMovementId || undefined,
      paymentStatus: e.paymentOption === 'pending' ? 'PENDING' : e.paymentOption === 'paid' ? 'PAID' : undefined,
    }));
    await handleBatchEntryCreation(mapped);
    setAccumulatedEntries([]);
    setChatPanelOpen(false);
  }, [accumulatedEntries]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    if (name === 'area') {
      setFormData(prev => ({ ...prev, subarea: '' }));
    }
    if (name === 'entryType') {
      setFormData(prev => ({ ...prev, area: '', subarea: '', serviceId: '' }));
    }
    // Auto-fill from selected service
    if (name === 'serviceId' && value) {
      const svc = services.find(s => s.id === value);
      if (svc) {
        setFormData(prev => ({
          ...prev,
          serviceId: value,
          concept: svc.serviceName,
          ...(svc.price ? { amount: String(svc.price) } : {}),
          area: prev.area || '',
          subarea: prev.subarea || svc.serviceName,
        }));
      }
    }
  };

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>, type: 'attachment' | 'factura' | 'xml') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFiles(prev => [...prev, { file, type }]);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToEntry = async (entryId: number) => {
    for (const { file, type } of pendingFiles) {
      try {
        let uploadEndpoint: 'ledgerAttachments' | 'ledgerFacturasPdf' | 'ledgerFacturasXml';
        if (type === 'attachment') uploadEndpoint = 'ledgerAttachments';
        else if (type === 'factura') uploadEndpoint = 'ledgerFacturasPdf';
        else uploadEndpoint = 'ledgerFacturasXml';

        const uploadResult = await uploadFiles(uploadEndpoint, { files: [file] });
        if (!uploadResult || uploadResult.length === 0) continue;

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

        await authFetch(`${API_URL}${apiEndpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        });
      } catch (err) {
        console.error(`Error uploading file ${file.name}:`, err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const amount = parseFloat(formData.amount);
      const amountPaid = formData.paymentOption === 'paid' ? amount : 0;
      const paymentStatus = formData.paymentOption === 'paid' ? 'PAID' : 'PENDING';
      const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount,
          amountPaid,
          paymentStatus,
          serviceId: formData.serviceId || undefined,
          serviceName: formData.serviceId ? services.find(s => s.id === formData.serviceId)?.serviceName : undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear movimiento');
      }
      const result = await response.json();

      // Upload pending files if any
      if (pendingFiles.length > 0 && result.data?.id) {
        await uploadFilesToEntry(result.data.id);
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
    doctorId: session?.user?.doctorId as string | undefined,
    formData,
    submitting,
    error,
    loadingAreas,
    filteredAreas,
    availableSubareas,
    services,
    voiceModalOpen, setVoiceModalOpen,
    voiceSidebarOpen, setVoiceSidebarOpen,
    sidebarInitialData,
    clearSidebarInitialData: () => setSidebarInitialData(undefined),
    chatPanelOpen, setChatPanelOpen,
    accumulatedEntries,
    pendingFiles,
    handleChange,
    handleSubmit,
    handleAddFile,
    handleRemovePendingFile,
    handleChatEntryUpdates,
    handleChatBatchCreate,
    handleVoiceModalComplete,
    handleVoiceConfirm,
  };
}
