// POST /api/enviar-documento/cita/[id] — la «Nota de venta» de una cita (su cobro) por correo con el PDF adjunto
// (lib/enviar-documento.ts). Permiso: route-permissions `enviar-documento/cita` → OWNER_ONLY (sale de SU Gmail).
import { postEnviarDocumento } from '@/lib/enviar-documento';

export const POST = postEnviarDocumento('cita');
