import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { prisma } from '@healthcare/database';
import { allFeatures, featureOf, voiceLabel } from '@/lib/llm-features';
import { costOfUsd } from '@/lib/llm-pricing';

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const [
      doctors,
      encounterCounts,
      prescriptionCounts,
      llmTokenTotals,
      llmByFeature,
      llmByModel,
    ] =
      await Promise.all([
        prisma.doctor.findMany({
          select: {
            id: true,
            slug: true,
            doctorFullName: true,
            primarySpecialty: true,
            createdAt: true,
            _count: {
              select: {
                patients: true,
                tasks: true,
                articles: true,
                bookings: true,
                ledgerEntries: true,
                sales: true,
                purchases: true,
                clients: true,
                products: true,
                llmTokenUsages: true,
              },
            },
          },
          orderBy: { doctorFullName: 'asc' },
        }),

        prisma.clinicalEncounter.groupBy({
          by: ['doctorId'],
          _count: { id: true },
        }),

        prisma.prescription.groupBy({
          by: ['doctorId'],
          _count: { id: true },
        }),

        prisma.llmTokenUsage.groupBy({
          by: ['doctorId'],
          _sum: { totalTokens: true },
        }),

        // QUÉ funciones de IA usa cada doctor. Se agrupa por endpoint Y surface:
        // `voice-transcribe` lo escriben once pantallas distintas, así que sin
        // `surface` sus filas son indistinguibles (las anteriores al 2026-08-27
        // traen NULL y se reportan como "origen desconocido", no se inventan).
        prisma.llmTokenUsage.groupBy({
          by: ['doctorId', 'endpoint', 'surface'],
          _sum: { totalTokens: true },
          _count: { id: true },
        }),

        // Costo por doctor: agrupado POR MODELO porque los precios difieren ~25x
        // entre gpt-4o-mini y claude-sonnet-5 — sumar tokens entre modelos da
        // volumen, no dinero.
        prisma.llmTokenUsage.groupBy({
          by: ['doctorId', 'model', 'provider'],
          _sum: {
            promptTokens: true,
            completionTokens: true,
            budgetTokens: true,
            durationSeconds: true,
          },
        }),
      ]);

    const encounterMap = new Map(encounterCounts.map((e) => [e.doctorId, e._count.id]));
    const prescriptionMap = new Map(prescriptionCounts.map((p) => [p.doctorId, p._count.id]));
    const tokenMap = new Map(llmTokenTotals.map((t) => [t.doctorId, t._sum.totalTokens ?? 0]));

    // doctorId -> { featureKey: solicitudes }. La llave de voz lleva su pantalla
    // pegada ("voice-transcribe:notas") para que "voz en notas" y "voz en
    // plantillas" NO caigan en el mismo cajón.
    const featureMap = new Map<string, Record<string, number>>();
    /** doctorId -> etiquetas legibles de lo que usó, ordenadas por uso. */
    const featureLabels = new Map<string, Array<{ key: string; label: string; requests: number; tokens: number }>>();
    for (const row of llmByFeature) {
      const key =
        row.endpoint === 'voice-transcribe'
          ? `voice-transcribe:${row.surface ?? 'desconocido'}`
          : row.endpoint;
      const counts = featureMap.get(row.doctorId) ?? {};
      counts[key] = (counts[key] ?? 0) + row._count.id;
      featureMap.set(row.doctorId, counts);

      const list = featureLabels.get(row.doctorId) ?? [];
      list.push({
        key,
        label: voiceLabel(row.endpoint, row.surface),
        requests: row._count.id,
        tokens: row._sum.totalTokens ?? 0,
      });
      featureLabels.set(row.doctorId, list);
    }

    // doctorId -> USD estimados. null = algún modelo sin precio (nunca 0 por omisión).
    const costMap = new Map<string, number | null>();
    for (const row of llmByModel) {
      const cost = costOfUsd({
        model: row.model,
        provider: row.provider,
        promptTokens: row._sum.promptTokens ?? 0,
        completionTokens: row._sum.completionTokens ?? 0,
        budgetTokens: row._sum.budgetTokens,
        durationSeconds: row._sum.durationSeconds,
      });
      const soFar = costMap.get(row.doctorId);
      if (soFar === null) continue;
      costMap.set(row.doctorId, cost === null ? null : (soFar ?? 0) + cost);
    }

    const result = doctors.map((doc) => ({
      slug: doc.slug,
      name: doc.doctorFullName,
      specialty: doc.primarySpecialty,
      createdAt: doc.createdAt.toISOString(),
      counts: {
        patients: doc._count.patients,
        encounters: encounterMap.get(doc.id) ?? 0,
        prescriptions: prescriptionMap.get(doc.id) ?? 0,
        tasks: doc._count.tasks,
        articles: doc._count.articles,
        bookings: doc._count.bookings,
        ledgerEntries: doc._count.ledgerEntries,
        sales: doc._count.sales,
        purchases: doc._count.purchases,
        clients: doc._count.clients,
        products: doc._count.products,
        llmRequests: doc._count.llmTokenUsages,
        llmTotalTokens: tokenMap.get(doc.id) ?? 0,
      },
      /** Solicitudes por función de IA. Llave de voz = "voice-transcribe:<pantalla>". */
      aiFeatures: featureMap.get(doc.id) ?? {},
      /** Lo mismo pero legible y ordenado por uso — para el detalle del doctor. */
      aiFeatureDetail: (featureLabels.get(doc.id) ?? []).sort((a, b) => b.requests - a.requests),
      /** USD estimados a precios de HOY. null = algún modelo sin precio. */
      // 0 y null son cosas DISTINTAS: `doctors` trae a TODOS, incluidos los que
      // nunca han usado IA. Sin este 0 explícito, un doctor sin una sola fila caía
      // en `undefined -> null` y se pintaba "n/d" ("no sé cuánto gastó") cuando la
      // verdad es que no gastó nada. null queda SOLO para modelo sin precio.
      aiCostUsd: costMap.has(doc.id) ? costMap.get(doc.id)! : 0,
    }));

    return NextResponse.json({
      doctors: result,
      // El catálogo viaja con la respuesta para que el admin arme columnas sin
      // duplicar el mapa de etiquetas (son dos apps distintas: dos verdades que
      // se separarían en silencio).
      features: allFeatures(),
      voiceFeatureKeys: [
        ...new Map(
          llmByFeature
            .filter((r) => r.endpoint === 'voice-transcribe')
            .map((r) => [
              `voice-transcribe:${r.surface ?? 'desconocido'}`,
              voiceLabel(r.endpoint, r.surface),
            ])
        ),
      ].map(([key, label]) => ({ key, label })),
      unknownEndpoints: [...new Set(
        llmByFeature.map((r) => r.endpoint).filter((e) => !featureOf(e).known)
      )],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Admin access')
      ? 403
      : message.includes('authorization') || message.includes('token') || message.includes('expired')
      ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
