import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { prisma } from '@healthcare/database';

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);

    const [doctors, encounterCounts, prescriptionCounts, llmTokenTotals] =
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
      ]);

    const encounterMap = new Map(encounterCounts.map((e) => [e.doctorId, e._count.id]));
    const prescriptionMap = new Map(prescriptionCounts.map((p) => [p.doctorId, p._count.id]));
    const tokenMap = new Map(llmTokenTotals.map((t) => [t.doctorId, t._sum.totalTokens ?? 0]));

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
    }));

    return NextResponse.json(result);
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
