'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { authFetch } from '@/lib/auth-fetch';
import { toast } from '@/lib/practice-toast';
import type { StatementDetail, BankMovement } from './conciliacion-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useStatementDetail(statementId: number) {
  const { data: session, status } = useSession({ required: true });

  const [statement, setStatement] = useState<StatementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unmatched' | 'matched' | 'ignored'>('all');

  const fetchDetail = useCallback(async () => {
    if (!session?.user?.email) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/practice-management/conciliacion-bancaria/${statementId}`);
      if (!res.ok) throw new Error('Error al cargar detalle');
      const result = await res.json();
      setStatement(result.data);
    } catch (err) {
      console.error('Error fetching statement detail:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.email, statementId]);

  useEffect(() => {
    if (session?.user?.email) fetchDetail();
  }, [session?.user?.email, fetchDetail]);

  const performAction = async (movId: number, body: Record<string, any>) => {
    setActionLoading(movId);
    try {
      const res = await authFetch(
        `${API_URL}/api/practice-management/conciliacion-bancaria/${statementId}/movements/${movId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      await fetchDetail();
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar movimiento');
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const confirmMatch = (movId: number) => performAction(movId, { action: 'confirm_match' });

  const unmatch = (movId: number) => performAction(movId, { action: 'unmatch' });

  const ignore = (movId: number) => performAction(movId, { action: 'ignore' });

  const createEntry = (
    movId: number,
    entryType: string,
    area: string,
    subarea: string,
    concept: string,
    saveRule: boolean,
  ) =>
    performAction(movId, {
      action: 'create_entry',
      entryType,
      area,
      subarea,
      concept,
      saveRule,
    });

  const linkExisting = (movId: number, ledgerEntryId: number) =>
    performAction(movId, { action: 'link_existing', ledgerEntryId });

  const filteredMovements = statement?.movements.filter((m) => {
    if (filter === 'all') return true;
    if (filter === 'unmatched') return m.matchStatus === 'unmatched';
    if (filter === 'matched') return m.matchStatus === 'matched_auto' || m.matchStatus === 'matched_confirmed';
    if (filter === 'ignored') return m.matchStatus === 'ignored';
    return true;
  }) || [];

  return {
    sessionStatus: status,
    loading,
    statement,
    actionLoading,
    filter,
    setFilter,
    filteredMovements,
    confirmMatch,
    unmatch,
    ignore,
    createEntry,
    linkExisting,
    fetchDetail,
  };
}
