/**
 * El mapa de rutas del widget de Ayuda — CURADO, nunca compuesto.
 *
 * El modelo sólo puede enlazar a una ruta de esta lista, y el servidor TIRA cualquier
 * enlace que no esté aquí (ver `respuesta.ts`). Dejarle armar URLs mandaría al doctor a
 * un 404 con toda la confianza del mundo (AYUDA WIDGET/01-ARQUITECTURA §4).
 *
 * Sólo rutas que el manual cubre o nombra. Ninguna lleva `?tab=`: hoy ninguna pantalla lo
 * lee, así que la pestaña se dice en el texto de la respuesta.
 */

export interface RutaAyuda {
  ruta: string;
  /** El nombre con el que el doctor ve esa pantalla (menú o título). */
  etiqueta: string;
  /** Para qué sirve — lo lee el modelo para elegir. */
  paraQue: string;
}

export const MAPA_DE_RUTAS: readonly RutaAyuda[] = [
  { ruta: '/dashboard/appointments', etiqueta: 'Mis Citas', paraQue: 'Agendar, ver y gestionar citas; calendario; rangos y bloqueos (menú «Más»)' },
  { ruta: '/dashboard/medical-records', etiqueta: 'Expedientes Médicos', paraQue: 'Lista de pacientes, buscar, filtrar, archivados' },
  { ruta: '/dashboard/medical-records/patients/new', etiqueta: 'Nuevo Paciente', paraQue: 'Crear un expediente' },
  { ruta: '/dashboard/medical-records/custom-templates', etiqueta: 'Plantillas', paraQue: 'Plantillas de consulta, de formulario pre-cita y de receta' },
  { ruta: '/dashboard/medical-records/receta', etiqueta: 'Receta PDF', paraQue: 'Cómo sale impresa la receta: nombre, cédulas, firma (sólo el titular)' },
  { ruta: '/dashboard/medical-records/importar', etiqueta: 'Importar pacientes', paraQue: 'Traer pacientes desde un Excel (sólo el titular)' },
  { ruta: '/dashboard/mi-perfil', etiqueta: 'Perfil Público', paraQue: 'Servicios (pestaña «Servicios») y consultorios (pestaña «Clinica»)' },
  { ruta: '/dashboard/cuenta', etiqueta: 'Mi Cuenta', paraQue: 'Plan, Google Calendar y Telegram (pestaña «Integraciones»), equipo' },
  { ruta: '/dashboard/pagos', etiqueta: 'Pagos', paraQue: 'Conectar Stripe o Mercado Pago para cobrar con links de pago' },
  { ruta: '/dashboard/facturacion', etiqueta: 'Facturación', paraQue: 'Emitir facturas (CFDI)' },
  { ruta: '/dashboard/practice/flujo-de-dinero', etiqueta: 'Flujo de Dinero', paraQue: 'Ingresos y egresos; ahí cae el cobro al completar una cita' },
];

const RUTAS_VALIDAS = new Set(MAPA_DE_RUTAS.map((r) => r.ruta));

export function esRutaDelMapa(ruta: string): boolean {
  return RUTAS_VALIDAS.has(ruta);
}

export function etiquetaDeRuta(ruta: string): string {
  return MAPA_DE_RUTAS.find((r) => r.ruta === ruta)?.etiqueta ?? ruta;
}

/**
 * Traduce la ruta donde está el doctor a algo que el modelo entienda, SIN meter al prompt
 * texto arbitrario del navegador: sólo se reconoce por prefijo contra el mapa, y lo demás
 * se reduce a "otra pantalla". Los ids (`/patients/abc123`) no viajan.
 */
export function pantallaActual(pathname: string | undefined | null): string {
  if (!pathname) return 'desconocida';
  // La más específica gana: /medical-records/receta antes que /medical-records.
  const candidatas = MAPA_DE_RUTAS.filter(
    (r) => pathname === r.ruta || pathname.startsWith(r.ruta + '/')
  ).sort((a, b) => b.ruta.length - a.ruta.length);
  if (candidatas.length > 0) {
    const r = candidatas[0];
    // Dentro de un expediente concreto el doctor ve el PERFIL, no la lista.
    if (r.ruta === '/dashboard/medical-records' && /\/patients\/[^/]+/.test(pathname)) {
      return 'el perfil de un paciente (Expedientes Médicos)';
    }
    return r.etiqueta;
  }
  if (pathname === '/dashboard') return 'el inicio del panel';
  return 'otra pantalla del panel';
}
