import { ImageResponse } from 'next/og';
import { PRICING } from '@/lib/product-content';

/**
 * Imagen de Open Graph de la HOME.
 *
 * Va como ruta y no como `opengraph-image.tsx` a proposito. El archivo de
 * convencion vive en el segmento raiz (`src/app/`), asi que CASCADEA a todo lo
 * que cuelgue de ahi — y los perfiles de doctor no declaran imagen propia. El
 * resultado seria un pitch de producto de cara a doctores colgado de cada
 * perfil de doctor de cara a PACIENTES. Como ruta, la referencia es explicita:
 * solo la usa quien la pide (hoy, `page.tsx`).
 *
 * El precio sale de `PRICING`, igual que en la pagina. Es el cuarto lugar
 * donde aparece el numero y el unico que se ve FUERA del sitio: si aqui
 * quedara un $550 escrito a mano, el dia que cambie el precio WhatsApp
 * seguiria anunciando el viejo.
 *
 * Sin fuentes remotas: `ImageResponse` tendria que descargar Vollkorn en cada
 * render, y una imagen de OG que falla no se degrada — simplemente no sale.
 */
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundImage:
            'linear-gradient(135deg, #312e81 8%, #4f46e5 65%, #f59e0b 185%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 2,
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          TUSALUD.PRO
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 28,
            fontSize: 82,
            fontWeight: 700,
            lineHeight: 1.08,
            color: '#ffffff',
          }}
        >
          <span>Todo tu consultorio,</span>
          <span>en un solo lugar</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            /* Sin esto el pill se ESTIRA a los 1200px: es hijo de un flex
               column, cuyo `align-items` por defecto es `stretch`. En el hero
               abraza el numero porque ahi el contenedor es `justify-center`
               en fila. */
            alignSelf: 'flex-start',
            gap: 14,
            marginTop: 44,
            padding: '18px 34px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,255,255,0.10)',
          }}
        >
          <span style={{ fontSize: 54, fontWeight: 700, color: '#ffffff' }}>
            ${PRICING.amount}
          </span>
          <span
            style={{ fontSize: 26, paddingBottom: 8, color: 'rgba(255,255,255,0.75)' }}
          >
            {PRICING.currency} {PRICING.ivaNote}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 40,
            fontSize: 28,
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          Agenda · Expediente · Informes · Facturación · Ingresos
        </div>
      </div>
    ),
    { ...size },
  );
}
