/**
 * GET /api/account/exportar — «Descargar mi información» (TIERS 04 §11.4, #6.3).
 * Devuelve un .zip con todo lo capturado, SIN los archivos adjuntos (sólo su
 * listado). Contenido: `lib/exportar-cuenta.ts`.
 *
 * - Vive bajo `/api/account/` A PROPÓSITO: es uno de los prefijos que una cuenta
 *   CONGELADA puede tocar (`RUTAS_DE_CUENTA_CONGELADA`) — es justo para ella.
 * - SÓLO el dueño: el route map ya marca `account` como OWNER_ONLY (un member
 *   rebota en validateAuthToken); `isOwner` se revisa aquí otra vez porque esto
 *   saca TODOS los expedientes de la cuenta.
 * - Se arma en memoria en una sola petición: la cuenta más grande medida en prod
 *   (2026-09-18) son 95 pacientes y 119 consultas ⇒ cientos de KB. No sale a
 *   ningún servicio de fuera, así que no hay nada que pueda tardar minutos.
 * - `zip` (no `zipSync`): comprimir es trabajo de CPU y esta API la comparten
 *   todos los doctores; la versión síncrona le para el event loop a los demás.
 */

import { NextResponse } from 'next/server';
import { zip, strToU8 } from 'fflate';
import { getAuthenticatedDoctor } from '@/lib/auth';
import { armarExportacion } from '@/lib/exportar-cuenta';

function comprimir(archivos: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(archivos, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

export async function GET(request: Request) {
  try {
    const { user, doctor } = await getAuthenticatedDoctor(request);
    if (!user.isOwner) {
      return NextResponse.json({ error: 'Sólo el titular de la cuenta puede descargar su información' }, { status: 403 });
    }

    const { archivos, faltantes } = await armarExportacion(doctor.id);
    const comprimido = await comprimir(
      Object.fromEntries(Object.entries(archivos).map(([ruta, contenido]) => [ruta, strToU8(contenido)])),
    );

    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });
    console.log('[EXPORTAR] zip', { slug: doctor.slug, archivos: Object.keys(archivos).length, bytes: comprimido.length, faltantes: faltantes.length });

    return new NextResponse(Buffer.from(comprimido), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tusalud-${doctor.slug}-${hoy}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    if (error?.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[EXPORTAR] error', error);
    return NextResponse.json({ error: 'No se pudo preparar la descarga' }, { status: 500 });
  }
}
