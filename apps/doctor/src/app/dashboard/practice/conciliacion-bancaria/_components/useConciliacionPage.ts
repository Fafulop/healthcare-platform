'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { authFetch } from '@/lib/auth-fetch';
import { uploadFiles } from '@/lib/uploadthing';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import type { BankStatement } from './conciliacion-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useConciliacionPage() {
  const { data: session, status } = useSession({ required: true });

  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchStatements = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/conciliacion-bancaria`);
      if (!res.ok) throw new Error('Error al cargar estados de cuenta');
      const result = await res.json();
      setStatements(result.data || []);
    } catch (err) {
      console.error('Error fetching statements:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    if (session?.user?.email) fetchStatements();
  }, [session?.user?.email, fetchStatements]);

  const handleUpload = async (
    file: File,
    bank: string,
    accountNumber: string,
    periodMonth: number,
    periodYear: number,
  ) => {
    setUploading(true);
    try {
      // 1. Upload file to UploadThing
      const uploadResult = await uploadFiles('bankStatementCsv', { files: [file] });
      const fileUrl = uploadResult[0].ufsUrl || uploadResult[0].url;
      const fileName = uploadResult[0].name;

      // 2. Read CSV content
      const csvContent = await file.text();

      // 3. Send to API for parsing + matching
      const res = await authFetch(`${API_URL}/api/practice-management/conciliacion-bancaria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          fileName,
          fileUrl,
          bank,
          accountNumber,
          periodMonth,
          periodYear,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al procesar estado de cuenta');
      }

      const result = await res.json();
      toast.success(
        `Estado de cuenta procesado: ${result.summary.totalMovements} movimientos, ${result.summary.matched} conciliados`
      );
      setShowUploadModal(false);
      fetchStatements();
      return result.data.id as number;
    } catch (err: any) {
      toast.error(err.message || 'Error al subir estado de cuenta');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!await practiceConfirm('¿Eliminar este estado de cuenta y todos sus movimientos?')) return;
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/conciliacion-bancaria/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');
      toast.success('Estado de cuenta eliminado');
      fetchStatements();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    }
  };

  return {
    sessionStatus: status,
    loading,
    statements,
    showUploadModal,
    setShowUploadModal,
    uploading,
    handleUpload,
    handleDelete,
    fetchStatements,
  };
}
