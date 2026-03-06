'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
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

export function useNewLedgerEntry() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

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
  });

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(false);
  const [sidebarInitialData, setSidebarInitialData] = useState<InitialChatData | undefined>(undefined);

  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [accumulatedEntries, setAccumulatedEntries] = useState<LedgerEntryData[]>([]);

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
          const response = await authFetch(`${API_URL}/api/practice-management/ledger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...entry,
              amount: entry.amount || 0,
              amountPaid: entry.amountPaid || 0,
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
      paymentOption: null,
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
      paymentOption: e.paymentOption || undefined,
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
      setFormData(prev => ({ ...prev, area: '', subarea: '' }));
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
        body: JSON.stringify({ ...formData, amount, amountPaid, paymentStatus }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear movimiento');
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
    voiceModalOpen, setVoiceModalOpen,
    voiceSidebarOpen, setVoiceSidebarOpen,
    sidebarInitialData,
    clearSidebarInitialData: () => setSidebarInitialData(undefined),
    chatPanelOpen, setChatPanelOpen,
    accumulatedEntries,
    handleChange,
    handleSubmit,
    handleChatEntryUpdates,
    handleChatBatchCreate,
    handleVoiceModalComplete,
    handleVoiceConfirm,
  };
}
