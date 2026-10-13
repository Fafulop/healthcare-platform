// POST /api/enviar-documento/receta/[id] — la receta por correo con el PDF adjunto (lib/enviar-documento.ts).
// Permiso: route-permissions `enviar-documento/receta` → OWNER_ONLY (sólo el titular: sale de SU Gmail).
import { postEnviarDocumento } from '@/lib/enviar-documento';

export const POST = postEnviarDocumento('receta');
