/**
 * GET /api/llm-usage
 *
 * Admin-only endpoint: returns LLM token usage aggregated across all doctors.
 *
 * Query params:
 *   range: '7d' | '28d' | '90d' (default '28d')
 *
 * Response:
 *   { range, since, totalTokens, totalRequests, promptTokens, completionTokens,
 *     byDoctor: [...], byEndpoint: [...] }
 *
 *   `byEndpoint[]` trae su costo y su desglose `byModel[]`: el costo de una función se arma
 *   sumando el de cada modelo con el que corrió, nunca multiplicando sus tokens por un precio.
 */

import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { prisma } from '@healthcare/database';
import { featureOf } from '@/lib/llm-features';
import { costRows, sumarCosto, type CostRow } from '@/lib/llm-cost-rows';

const VALID_RANGES = ['7d', '28d', '90d'] as const;
type Range = typeof VALID_RANGES[number];

function getSince(range: Range): Date {
  const days = range === '7d' ? 7 : range === '28d' ? 28 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const url = new URL(request.url);
    const range = (url.searchParams.get('range') || '28d') as Range;
    if (!VALID_RANGES.includes(range)) {
      return NextResponse.json({ error: 'Invalid range. Use 7d, 28d, or 90d' }, { status: 400 });
    }

    const since = getSince(range);

    // Aggregate totals by doctor
    const byDoctorRaw = await prisma.llmTokenUsage.groupBy({
      by: ['doctorId'],
      where: { createdAt: { gte: since } },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
      _count: { id: true },
      orderBy: { _sum: { totalTokens: 'desc' } },
    });

    // Aggregate by doctor + endpoint for detailed breakdown
    const byDoctorEndpointRaw = await prisma.llmTokenUsage.groupBy({
      by: ['doctorId', 'endpoint'],
      where: { createdAt: { gte: since } },
      _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
      _count: { id: true },
    });

    // Costo: POR MODELO (los precios difieren ~25x entre gpt-4o-mini y claude-sonnet-5: un
    // total de tokens sumado entre modelos es volumen, no dinero) y separando las filas con y
    // sin budgetTokens — ver `llm-cost-rows.ts`, que es el porqué de no hacerlo aquí.
    const filas = await costRows({ createdAt: { gte: since } });

    /** doctorId -> USD estimados. `null` = hay algún modelo que no sabemos cobrar. */
    const costByDoctor = new Map<string, number | null>();
    /** endpoint -> USD estimados, con la misma regla. */
    const costByEndpoint = new Map<string, number | null>();
    /** endpoint -> totales, y su desglose por modelo (sumando a todos los doctores). */
    type PorModelo = Omit<CostRow, 'doctorId' | 'endpoint'>;
    const endpoints = new Map<string, { requests: number; promptTokens: number; completionTokens: number; totalTokens: number; modelos: Map<string, PorModelo> }>();
    for (const f of filas) {
      sumarCosto(costByDoctor, f.doctorId, f.costUsd);
      sumarCosto(costByEndpoint, f.endpoint, f.costUsd);
      const ep = endpoints.get(f.endpoint) ?? { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, modelos: new Map() };
      ep.requests += f.requests;
      ep.promptTokens += f.promptTokens;
      ep.completionTokens += f.completionTokens;
      ep.totalTokens += f.totalTokens;
      const llave = `${f.model}\u0000${f.provider}`;
      const m = ep.modelos.get(llave);
      if (!m) {
        ep.modelos.set(llave, { model: f.model, provider: f.provider, requests: f.requests, promptTokens: f.promptTokens, completionTokens: f.completionTokens, totalTokens: f.totalTokens, costUsd: f.costUsd });
      } else {
        m.requests += f.requests;
        m.promptTokens += f.promptTokens;
        m.completionTokens += f.completionTokens;
        m.totalTokens += f.totalTokens;
        m.costUsd = m.costUsd === null || f.costUsd === null ? null : m.costUsd + f.costUsd;
      }
      endpoints.set(f.endpoint, ep);
    }

    // Fetch doctor names
    const doctorIds = byDoctorRaw.map((d) => d.doctorId);
    const doctors = await prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, doctorFullName: true, slug: true },
    });
    const doctorMap = new Map(doctors.map((d) => [d.id, d]));

    // Build per-doctor endpoint map
    const doctorEndpoints = new Map<string, Array<{ endpoint: string; totalTokens: number; promptTokens: number; completionTokens: number; requests: number }>>();
    for (const row of byDoctorEndpointRaw) {
      const list = doctorEndpoints.get(row.doctorId) ?? [];
      list.push({
        endpoint: row.endpoint,
        totalTokens: row._sum.totalTokens ?? 0,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        requests: row._count.id,
      });
      doctorEndpoints.set(row.doctorId, list);
    }

    // Compute overall totals
    let totalTokens = 0;
    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    for (const row of byDoctorRaw) {
      totalTokens += row._sum.totalTokens ?? 0;
      totalRequests += row._count.id;
      totalPromptTokens += row._sum.promptTokens ?? 0;
      totalCompletionTokens += row._sum.completionTokens ?? 0;
    }

    const byDoctor = byDoctorRaw.map((row) => {
      const doctor = doctorMap.get(row.doctorId);
      const endpoints = (doctorEndpoints.get(row.doctorId) ?? []).sort(
        (a, b) => b.totalTokens - a.totalTokens
      );
      return {
        doctorId: row.doctorId,
        doctorName: doctor?.doctorFullName ?? 'Doctor desconocido',
        slug: doctor?.slug ?? '',
        totalTokens: row._sum.totalTokens ?? 0,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        requests: row._count.id,
        /** USD estimados a precios de HOY. `null` = algún modelo sin precio. */
        costUsd: costByDoctor.get(row.doctorId) ?? null,
        byEndpoint: endpoints,
      };
    });

    // Sale de las mismas filas que el costo: así el total de una función es, por construcción,
    // la suma de sus modelos (antes eran dos groupBy que tenían que coincidir).
    const byEndpoint = [...endpoints.entries()]
      .map(([endpoint, ep]) => ({
        endpoint,
        /** Nombre para un humano ("Ayuda (widget)"); lo desconocido regresa con su nombre crudo. */
        label: featureOf(endpoint).label,
        totalTokens: ep.totalTokens,
        promptTokens: ep.promptTokens,
        completionTokens: ep.completionTokens,
        requests: ep.requests,
        /** USD estimados a precios de HOY. `null` = algún modelo sin precio. */
        costUsd: costByEndpoint.get(endpoint) ?? null,
        byModel: [...ep.modelos.values()].sort((a, b) => b.requests - a.requests),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

    return NextResponse.json({
      range,
      since: since.toISOString(),
      totalTokens,
      totalRequests,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      // Total global. Si a ALGÚN doctor le faltó precio, el total va `null`:
      // una suma parcial presentada como total es peor que no dar total.
      totalCostUsd: byDoctor.some((d) => d.costUsd === null)
        ? null
        : byDoctor.reduce((acc, d) => acc + (d.costUsd ?? 0), 0),
      uniqueDoctors: byDoctorRaw.length,
      byDoctor,
      byEndpoint,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Admin access') ? 403
      : message.includes('authorization') || message.includes('token') || message.includes('expired') ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
