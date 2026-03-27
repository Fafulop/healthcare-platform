'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-notice-v1')) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('cookie-notice-v1', '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1f2937',
      color: '#f9fafb',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      fontSize: '0.8rem',
      zIndex: 50,
    }}>
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        Este sitio utiliza cookies de Google Analytics para análisis de tráfico agregado.{' '}
        <Link href="/privacidad#cookies" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
          Más información
        </Link>
      </p>
      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          backgroundColor: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.375rem 0.875rem',
          fontSize: '0.8rem',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Entendido
      </button>
    </div>
  );
}
