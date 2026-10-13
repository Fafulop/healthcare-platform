// POST /api/enviar-documento/venta/[id] — la nota de venta por correo con el PDF adjunto (lib/enviar-documento.ts).
// Permiso: route-permissions `enviar-documento/venta` → OWNER_ONLY (sólo el titular: sale de SU Gmail).
import { postEnviarDocumento } from '@/lib/enviar-documento';

export const POST = postEnviarDocumento('venta');
