'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { EncounterTemplate } from '@/types/encounter-template';
import { toast } from '@/lib/practice-toast';
import { practiceConfirm } from '@/lib/practice-confirm';

export function useTemplatesPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [templates, setTemplates] = useState<EncounterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/medical-records/templates');
      const data = await res.json();

      if (data.success) {
        setTemplates(data.data);
      } else {
        setError(data.error || 'Error al cargar plantillas');
      }
    } catch (err) {
      setError('Error al cargar plantillas');
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: EncounterTemplate) => {
    if (template.isDefault) {
      toast.error('No se puede eliminar la plantilla predeterminada');
      return;
    }

    const confirmed = await practiceConfirm(`¿Eliminar la plantilla "${template.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(template.id);
      const res = await fetch(`/api/medical-records/templates/${template.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      } else {
        toast.error(data.error || 'Error al eliminar plantilla');
      }
    } catch (err) {
      toast.error('Error al eliminar plantilla');
      console.error('Error deleting template:', err);
    } finally {
      setDeletingId(null);
      setOpenMenuId(null);
    }
  };

  const handleSetDefault = async (template: EncounterTemplate) => {
    if (template.isDefault) return;

    try {
      const res = await fetch(`/api/medical-records/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();

      if (data.success) {
        setTemplates((prev) =>
          prev.map((t) => ({ ...t, isDefault: t.id === template.id }))
        );
      } else {
        toast.error(data.error || 'Error al actualizar plantilla');
      }
    } catch (err) {
      toast.error('Error al actualizar plantilla');
      console.error('Error updating template:', err);
    } finally {
      setOpenMenuId(null);
    }
  };

  return {
    sessionStatus: status,
    templates,
    loading,
    error,
    deletingId,
    openMenuId, setOpenMenuId,
    fetchTemplates,
    handleDelete,
    handleSetDefault,
  };
}
