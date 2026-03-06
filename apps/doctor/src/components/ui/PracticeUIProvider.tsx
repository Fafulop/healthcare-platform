'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { registerToastHandler } from '@/lib/practice-toast';
import { registerConfirmHandler } from '@/lib/practice-confirm';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Toast = { id: number; message: string; type: 'error' | 'success' | 'warning' };
type ConfirmState = { message: string; title?: string; callback: (result: boolean) => void } | null;

export function PracticeUIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const nextId = useRef(0);

  useEffect(() => {
    registerToastHandler((message, type) => {
      const id = ++nextId.current;
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    });

    registerConfirmHandler((message, title, callback) => {
      setConfirmState({ message, title, callback });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState?.callback(true);
    setConfirmState(null);
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState?.callback(false);
    setConfirmState(null);
  }, [confirmState]);

  return (
    <>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium animate-in slide-in-from-bottom-2 ${
              toast.type === 'error' ? 'bg-red-600' :
              toast.type === 'success' ? 'bg-green-600' : 'bg-yellow-500'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      <ConfirmModal
        open={!!confirmState}
        message={confirmState?.message ?? ''}
        title={confirmState?.title}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
