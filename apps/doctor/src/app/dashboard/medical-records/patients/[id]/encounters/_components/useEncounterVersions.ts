'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import type { Version } from './encounter-types';

export function useEncounterVersions() {
  const params = useParams();
  const patientId = params.id as string;
  const encounterId = params.encounterId as string;

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login');
    },
  });

  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [patientId, encounterId]);

  const fetchVersions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/medical-records/patients/${patientId}/encounters/${encounterId}/versions`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al cargar versiones');
      }

      const data = await res.json();
      setVersions(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading versions');
    } finally {
      setLoading(false);
    }
  };

  return {
    // Route
    patientId,
    encounterId,
    sessionStatus: status,
    // Data
    versions,
    selectedVersion, setSelectedVersion,
    // Loading / error
    loading,
    error,
  };
}
