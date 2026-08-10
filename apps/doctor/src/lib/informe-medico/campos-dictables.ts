/**
 * QUÉ CAMPOS se le pueden ofrecer a un modelo — la lista que comparten el
 * DICTADO (05-VOZ) y el CHAT (06-AGENTE).
 *
 * 🔴 Existe por la misma razón que `campos-del-informe.ts`: si cada endpoint
 * arma su propia lista, los dos acaban ofreciendo conjuntos distintos y el
 * doctor ve que el dictado sí llena un campo y el chat dice que no existe.
 *
 * Dos reglas que NO son obvias y que estaban enterradas en `dictar/route.ts`:
 *
 *  1. **Un campo se ofrece UNA vez, con su recuadro más grande.** Un campo puede
 *     tener varios widgets en la hoja; ofrecerlo N veces le dice al modelo que
 *     son N campos distintos.
 *  2. **Un recuadro INMENSURABLE se ignora.** `capacidadDeCaja` devuelve
 *     `Infinity` para los muñones ocultos (ancho o alto <= 0). Darles un tope
 *     inventado le decía al modelo que cabían 200 caracteres en una caja real de
 *     14, y el PDF salía en 3 pt.
 */
import { capacidadDeCaja } from './capacidad';
import { etiquetaCanonica } from './canonical';
import type { GeometriaFormato } from './geometria-formato';

export interface CampoDictable {
  /** Clave canónica o cruda: es la que el modelo debe devolver. */
  clave: string;
  /** Lo que el campo dice en la hoja. */
  etiqueta: string;
  /** Aproximado, a 6 pt. Le dice al modelo cuánto texto cabe de verdad. */
  maxCaracteres: number;
  /** 1-based, como la ve el doctor. */
  pagina: number;
}

/**
 * Los campos de TEXTO que un modelo puede llenar.
 *
 * ⚠️ Las **casillas quedan fuera a propósito**, en el dictado y en el chat. Sus
 * on-states son opacos (`/1`, `/M`, `/CE`): ni el modelo ni el doctor pueden
 * saber que `/2` significa "Hospital" sin mirar la hoja. Proponer uno sería
 * afirmar algo a la aseguradora sin saber qué se está afirmando. Se marcan a
 * mano en el visor, que sí enseña dónde cae cada recuadro.
 *
 * @param pagina 1-based; `null` = toda la hoja.
 */
export function camposDictables(geo: GeometriaFormato, pagina: number | null): CampoDictable[] {
  const porClave = new Map<string, CampoDictable>();

  for (const c of geo.cajas) {
    if (c.tipo !== 'texto') continue;
    if (pagina !== null && c.pagina !== pagina - 1) continue;

    const cap = capacidadDeCaja(c.ancho, c.alto, c.multilinea, 0);
    if (!Number.isFinite(cap.maximo)) continue;

    const previo = porClave.get(c.clave);
    if (!previo || cap.maximo > previo.maxCaracteres) {
      porClave.set(c.clave, {
        clave: c.clave,
        etiqueta: etiquetaCanonica(c.clave),
        maxCaracteres: cap.maximo,
        pagina: c.pagina + 1,
      });
    }
  }

  // 🔴 Orden ESTABLE (página, luego clave) y no el de inserción del AcroForm.
  // El catálogo se manda idéntico en cada turno del chat, y OpenAI sólo cachea
  // el prefijo COMÚN del prompt: un orden que cambie tira la caché y cobra el
  // catálogo completo cada vez.
  return [...porClave.values()].sort(
    (a, b) => a.pagina - b.pagina || a.clave.localeCompare(b.clave)
  );
}
