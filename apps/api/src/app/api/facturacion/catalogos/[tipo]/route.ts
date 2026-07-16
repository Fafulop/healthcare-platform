import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedDoctor } from '@/lib/auth';
import {
  getCatalogUsoCfdi,
  getCatalogRegimenesFiscales,
  getCatalogFormasPago,
  getCatalogMetodosPago,
  searchProductCodes,
  searchUnitCodes,
  isFacturamaConfigured,
} from '@/lib/facturama';

// GET /api/facturacion/catalogos/:tipo - Get SAT catalogs from Facturama
// Supported tipos: uso-cfdi, regimenes-fiscales, formas-pago, metodos-pago, productos, unidades
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  try {
    await getAuthenticatedDoctor(request);
    const { tipo } = await params;

    if (!isFacturamaConfigured()) {
      // Return hardcoded common values when Facturama is not configured.
      // _offline: true so consumers (search_catalogo_sat) never label this as the official catalog.
      return NextResponse.json({ data: getOfflineCatalog(tipo), _offline: true });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();

    let data;

    switch (tipo) {
      case 'uso-cfdi':
        // CfdiUses accepts optional RFC — results vary by person type (fisica vs moral)
        data = await getCatalogUsoCfdi(query || undefined);
        break;
      case 'regimenes-fiscales':
        data = await getCatalogRegimenesFiscales();
        break;
      case 'formas-pago':
        data = await getCatalogFormasPago();
        break;
      case 'metodos-pago':
        data = await getCatalogMetodosPago();
        break;
      case 'productos':
        if (!query) {
          return NextResponse.json(
            { error: 'Parámetro de búsqueda "q" requerido' },
            { status: 400 }
          );
        }
        data = await searchProductCodes(query);
        break;
      case 'unidades':
        if (!query) {
          return NextResponse.json(
            { error: 'Parámetro de búsqueda "q" requerido' },
            { status: 400 }
          );
        }
        data = await searchUnitCodes(query);
        break;
      default:
        return NextResponse.json(
          { error: `Catálogo "${tipo}" no soportado. Usa: uso-cfdi, regimenes-fiscales, formas-pago, metodos-pago, productos, unidades` },
          { status: 400 }
        );
    }

    if (!Array.isArray(data)) {
      // An empty/non-array 200 from Facturama means a broken integration (wrong path,
      // contract change) — the /api-lite outage looked exactly like this. Treat it as
      // a failure instead of returning plausible emptiness.
      console.error(`Catálogo "${tipo}": respuesta no-array de Facturama`, data);
      const offline = getOfflineCatalog(tipo);
      if (offline.length > 0) {
        return NextResponse.json({ data: offline, _offline: true });
      }
      return NextResponse.json(
        { error: `Catálogo "${tipo}" no disponible (respuesta inválida de Facturama)` },
        { status: 502 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error.name === 'FacturamaError') {
      // Fallback to offline catalogs on Facturama error
      const { tipo } = await params;
      const offline = getOfflineCatalog(tipo);
      if (offline.length > 0) {
        return NextResponse.json({ data: offline, _offline: true });
      }
      return NextResponse.json(
        { error: `Error al consultar catálogo: ${error.message}` },
        { status: 502 }
      );
    }
    console.error('Error fetching catalog:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * Offline/fallback catalogs for common values used in medical billing.
 * Used when Facturama credentials are not yet configured.
 */
function getOfflineCatalog(tipo: string) {
  switch (tipo) {
    case 'uso-cfdi':
      return [
        { Value: 'D01', Name: 'Honorarios médicos, dentales y gastos hospitalarios' },
        { Value: 'D02', Name: 'Gastos médicos por incapacidad o discapacidad' },
        { Value: 'G03', Name: 'Gastos en general' },
        { Value: 'S01', Name: 'Sin efectos fiscales' },
        { Value: 'CP01', Name: 'Pagos' },
      ];
    case 'regimenes-fiscales':
      return [
        { Value: '601', Name: 'General de Ley Personas Morales' },
        { Value: '603', Name: 'Personas Morales con Fines no Lucrativos' },
        { Value: '605', Name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
        { Value: '606', Name: 'Arrendamiento' },
        { Value: '608', Name: 'Demás ingresos' },
        { Value: '612', Name: 'Personas Físicas con Actividades Empresariales y Profesionales' },
        { Value: '616', Name: 'Sin obligaciones fiscales' },
        { Value: '621', Name: 'Incorporación Fiscal' },
        { Value: '625', Name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
        { Value: '626', Name: 'Régimen Simplificado de Confianza' },
      ];
    case 'formas-pago':
      return [
        { Value: '01', Name: 'Efectivo' },
        { Value: '02', Name: 'Cheque nominativo' },
        { Value: '03', Name: 'Transferencia electrónica de fondos' },
        { Value: '04', Name: 'Tarjeta de crédito' },
        { Value: '28', Name: 'Tarjeta de débito' },
        { Value: '99', Name: 'Por definir' },
      ];
    case 'metodos-pago':
      return [
        { Value: 'PUE', Name: 'Pago en una sola exhibición' },
        { Value: 'PPD', Name: 'Pago en parcialidades o diferido' },
      ];
    default:
      return [];
  }
}
