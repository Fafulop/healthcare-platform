'use client';

import { useState, useCallback } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { uploadFiles } from '@/lib/uploadthing';
import { toast } from '@/lib/practice-toast';
import type { PdfParsedMovement, ReviewItem } from './pdf-import-types';

type Step = 'idle' | 'uploading' | 'parsing' | 'review' | 'importing';

export function usePdfImport(onImportDone: () => void) {
  const [step, setStep] = useState<Step>('idle');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<{ pdfSizeKB: number; tokensUsed: number } | null>(null);
  const [uploadContext, setUploadContext] = useState<{
    bank: string;
    accountNumber: string;
    periodMonth: number;
    periodYear: number;
    fileUrl: string;
  } | null>(null);

  const handlePdfUpload = useCallback(async (
    file: File,
    bank: string,
    accountNumber: string,
    periodMonth: number,
    periodYear: number,
  ) => {
    setStep('uploading');
    try {
      // 1. Upload to UploadThing
      const uploadResult = await uploadFiles('bankStatementPdf', { files: [file] });
      const fileUrl = uploadResult[0].ufsUrl || uploadResult[0].url;

      setUploadContext({ bank, accountNumber, periodMonth, periodYear, fileUrl });
      setStep('parsing');

      // 2. Send to AI for parsing
      const res = await authFetch('/api/bank-statement-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, bank, periodMonth, periodYear }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al procesar el PDF');
      }

      const result = await res.json();
      const movements: PdfParsedMovement[] = result.data.movements;
      setMeta(result.data.meta);

      if (movements.length === 0) {
        toast.error('No se encontraron movimientos en el PDF');
        setStep('idle');
        return;
      }

      // 3. Convert to review items (all pre-selected)
      const reviewItems: ReviewItem[] = movements.map((m) => ({
        ...m,
        selected: true,
        entryType: m.movementType === 'deposit' ? 'ingreso' as const : 'egreso' as const,
        area: m.movementType === 'deposit' ? 'Consultas Médicas' : 'Gastos Operativos',
        subarea: '',
        formaDePago: 'transferencia',
      }));

      setItems(reviewItems);
      setStep('review');
      toast.success(`${movements.length} movimientos extraídos del PDF`);
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el PDF');
      setStep('idle');
    }
  }, []);

  const toggleItem = useCallback((index: number) => {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected })));
  }, []);

  const updateItem = useCallback((index: number, field: keyof ReviewItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleImport = useCallback(async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error('Selecciona al menos un movimiento');
      return;
    }

    setStep('importing');
    try {
      const res = await authFetch('/api/bank-statement-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: selected.map((item) => ({
            transactionDate: item.transactionDate,
            concept: item.concept,
            amount: item.amount,
            entryType: item.entryType,
            area: item.area,
            subarea: item.subarea,
            formaDePago: item.formaDePago,
            reference: item.reference,
          })),
          bank: uploadContext?.bank,
          periodMonth: uploadContext?.periodMonth,
          periodYear: uploadContext?.periodYear,
          fileUrl: uploadContext?.fileUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al importar movimientos');
      }

      const result = await res.json();
      toast.success(`${result.data.created} movimientos importados al flujo de dinero`);
      setStep('idle');
      setItems([]);
      setMeta(null);
      setUploadContext(null);
      onImportDone();
    } catch (err: any) {
      toast.error(err.message || 'Error al importar');
      setStep('review');
    }
  }, [items, uploadContext, onImportDone]);

  const cancelReview = useCallback(() => {
    setStep('idle');
    setItems([]);
    setMeta(null);
    setUploadContext(null);
  }, []);

  const selectedCount = items.filter((i) => i.selected).length;
  const totalDeposits = items.filter((i) => i.selected && i.entryType === 'ingreso').reduce((s, i) => s + i.amount, 0);
  const totalWithdrawals = items.filter((i) => i.selected && i.entryType === 'egreso').reduce((s, i) => s + i.amount, 0);

  return {
    step,
    items,
    meta,
    selectedCount,
    totalDeposits,
    totalWithdrawals,
    handlePdfUpload,
    toggleItem,
    toggleAll,
    updateItem,
    handleImport,
    cancelReview,
  };
}
