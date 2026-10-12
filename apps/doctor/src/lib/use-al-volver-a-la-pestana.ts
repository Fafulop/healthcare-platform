'use client';

import { useEffect, useRef } from 'react';

/**
 * Vuelve a leer algo cuando el doctor REGRESA a esta pantalla (nota N10, 2026-10-12): la agenda, «Cobros»,
 * la visita y el perfil cargan sus citas una vez al abrirse; si la casilla «¿Necesita factura?» (o
 * cualquier cosa de la cita) cambiaba en otra pestaña, ésta seguía enseñando lo viejo hasta recargar — el
 * usuario vio la misma cita marcada en el calendario y desmarcada en «Cobros».
 *
 * Dos señales: `visibilitychange` (cambiar de pestaña) y `focus` (dos ventanas lado a lado: ninguna deja de
 * ser visible). Con un margen para que volver no dispare dos lecturas. SÓLO para recargar datos que se
 * pintan (las citas), nunca un formulario que el doctor esté escribiendo: eso borraría lo no guardado.
 */
export function useAlVolverALaPestana(recargar: () => unknown) {
  const ref = useRef(recargar);
  ref.current = recargar;
  useEffect(() => {
    let ultima = 0;
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      const ahora = Date.now();
      if (ahora - ultima < 2000) return;
      ultima = ahora;
      ref.current();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, []);
}
