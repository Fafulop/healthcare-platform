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
 * ⚠️ Aquí sólo hay **texto**. Las casillas van por su propio camino
 * (`etiquetas-de-la-hoja.ts`): son grupos EXCLUYENTES y el modelo las elige por
 * la etiqueta impresa, no por el on-state. Antes esta nota decía que quedaban
 * fuera del todo — el chat sí las propone desde 2026-08-10, salvo las que
 * `casillasParaElAgente()` excluye (consentimientos del paciente, facturación,
 * grupos que no se pueden nombrar).
 *
 * @param pagina 1-based; `null` = toda la hoja.
 */
export function camposDictables(
  geo: GeometriaFormato,
  pagina: number | null,
  /**
   * `clave -> lo que dice la hoja`, de `etiquetas-de-la-hoja.ts`. Sólo trae los
   * campos cuyo NOMBRE no significa nada (`Día_4`, `undefined_7`).
   *
   * 🔴 Sin esto el modelo recibía `campo:Día_4` y no podía elegirlo: por eso las
   * fechas no aterrizaban. Con esto recibe "Fecha de cirugía:".
   */
  contexto: Record<string, string> = {}
): CampoDictable[] {
  const porClave = new Map<string, CampoDictable>();

  for (const c of geo.cajas) {
    if (c.tipo !== 'texto') continue;
    if (pagina !== null && c.pagina !== pagina - 1) continue;

    const cap = capacidadDeCaja(c.ancho, c.alto, c.multilinea, 0);
    if (!Number.isFinite(cap.maximo)) continue;

    // 🔴 El `maxLength` del propio PDF es un tope DURO, y manda sobre el visual.
    // Las 7 cajas de fecha de AXA lo declaran en 8 (quieren `ddmmaaaa`) mientras
    // que por tamaño les caben ~38: anunciar 38 hacía que el modelo escribiera
    // `03/03/2026`, que `setText` RECHAZA — y con eso se caía la generación del
    // PDF entero (ni borrador ni final).
    const maximo = c.maxLength !== undefined ? Math.min(cap.maximo, c.maxLength) : cap.maximo;

    const previo = porClave.get(c.clave);
    if (!previo || maximo > previo.maxCaracteres) {
      porClave.set(c.clave, {
        clave: c.clave,
        etiqueta: contexto[c.clave] ?? etiquetaCanonica(c.clave),
        maxCaracteres: maximo,
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
