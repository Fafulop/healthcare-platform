/**
 * Script inline que habilita los reveals al scroll (ver components/ScrollReveals.tsx).
 *
 * Marca <html> como "listo para animar" ANTES de que pinte el contenido, para
 * que los elementos no aparezcan y desaparezcan. Se salta si el usuario pidió
 * "reduce motion", y se auto-borra a los 2.5 s: si el bundle de GSAP no cargara,
 * la página se ve completa igual en vez de quedarse en blanco.
 *
 * Vive aquí —y no dentro de ScrollReveals.tsx— porque lo renderizan Server
 * Components y ese módulo es 'use client'. Una sola copia para todas las
 * páginas que usen reveals.
 */
export const REVEAL_BOOTSTRAP = `(function(){try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('reveal-ready');setTimeout(function(){r.classList.remove('reveal-ready');},2500);}catch(e){}})();`;
