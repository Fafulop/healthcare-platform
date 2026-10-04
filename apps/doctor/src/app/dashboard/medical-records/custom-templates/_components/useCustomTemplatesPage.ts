'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { CustomEncounterTemplate } from '@/types/custom-encounter';
import { toast } from '@/lib/practice-toast';

export function useCustomTemplatesPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [templates, setTemplates] = useState<CustomEncounterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/custom-templates');
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar las plantillas');
      }

      setTemplates(data.data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al eliminar la plantilla');
      }

      fetchTemplates();
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar la plantilla');
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      const res = await fetch(`/api/custom-templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al marcarla como predeterminada');
      }

      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Error al marcarla como predeterminada');
    }
  };

  return {
    sessionStatus: status,
    templates,
    loading,
    error,
    deleteConfirm, setDeleteConfirm,
    handleDelete,
    handleSetDefault,
  };
}
