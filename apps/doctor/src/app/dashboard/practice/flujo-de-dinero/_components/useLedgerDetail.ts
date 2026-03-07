'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth-fetch';
import { uploadFiles } from '@/lib/uploadthing';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';
import type { LedgerEntry } from './ledger-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface Attachment {
  id: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  createdAt: string;
}

export interface Factura {
  id: number;
  fileName: string;
  fileUrl: string;
  folio: string | null;
  uuid: string | null;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: string | null;
  createdAt: string;
}

export interface FacturaXml {
  id: number;
  fileName: string;
  fileUrl: string;
  folio: string | null;
  uuid: string;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: string | null;
  subtotal: string | null;
  iva: string | null;
  fecha: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  moneda: string | null;
  createdAt: string;
}

export interface LedgerDetail extends LedgerEntry {
  attachments: Attachment[];
  facturas: Factura[];
  facturasXml: FacturaXml[];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function useLedgerDetail() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const entryId = params.id as string;

  const [entry, setEntry] = useState<LedgerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'attachment' | 'factura' | 'xml' | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchEntry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntry = async () => {
    setLoading(true);
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`);
      if (!response.ok) throw new Error('Error al cargar movimiento');
      const result = await response.json();
      setEntry(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!await practiceConfirm(`¿Estás seguro de eliminar el movimiento ${entry.internalId}?`)) return;
    try {
      const response = await authFetch(`${API_URL}/api/practice-management/ledger/${entryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Error al eliminar movimiento');
      router.push('/dashboard/practice/flujo-de-dinero');
    } catch (err: any) {
      toast.error(err.message);
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
      if (!uploadResult || uploadResult.length === 0) throw new Error('Error al subir archivo a UploadThing');

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

      await fetchEntry();
      setUploadType(null);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  return {
    entry,
    loading,
    error,
    uploading,
    uploadType,
    handleDelete,
    handleFileUpload,
  };
}
