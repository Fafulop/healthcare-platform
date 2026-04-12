// GET /api/medical-records/stats
// Returns monthly counts for patients, encounters, and prescriptions
// for the authenticated doctor.
// Query params:
//   year (optional) — 4-digit year, defaults to current year

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';

function buildYearBounds(year: number) {
  return {
    startDate: new Date(year, 0, 1),      // Jan 1 00:00 local
    endDate:   new Date(year + 1, 0, 1),  // Jan 1 next year
  };
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function groupByMonth(dates: Date[], startDate: Date, endDate: Date): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of dates) {
    if (d < startDate || d >= endDate) continue;
    const key = monthKey(d);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, error: 'Año inválido' }, { status: 400 });
    }

    const { startDate, endDate } = buildYearBounds(year);

    // Fetch all three datasets in parallel — only select the date field needed
    const [patientDates, encounterDates, prescriptionDates] = await Promise.all([
      prisma.patient.findMany({
        where:  { doctorId },
        select: { createdAt: true },
      }),
      prisma.clinicalEncounter.findMany({
        where:  { doctorId },
        select: { encounterDate: true },
      }),
      prisma.prescription.findMany({
        where:  { doctorId },
        select: { prescriptionDate: true },
      }),
    ]);

    const patientCounts      = groupByMonth(patientDates.map(p => p.createdAt),           startDate, endDate);
    const encounterCounts    = groupByMonth(encounterDates.map(e => e.encounterDate),      startDate, endDate);
    const prescriptionCounts = groupByMonth(prescriptionDates.map(r => r.prescriptionDate), startDate, endDate);

    // Build all 12 months, filling gaps with zero
    const data = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      data.push({
        month:         key,
        patients:      patientCounts[key]      ?? 0,
        encounters:    encounterCounts[key]    ?? 0,
        prescriptions: prescriptionCounts[key] ?? 0,
      });
    }

    // Available years (union of all three datasets + current year)
    const allYears = new Set<number>();
    for (const { createdAt } of patientDates)      allYears.add(createdAt.getFullYear());
    for (const { encounterDate } of encounterDates) allYears.add(encounterDate.getFullYear());
    for (const { prescriptionDate } of prescriptionDates) allYears.add(prescriptionDate.getFullYear());
    allYears.add(new Date().getFullYear());

    return NextResponse.json({
      success: true,
      year,
      data,
      availableYears: [...allYears].sort((a, b) => b - a),
    });
  } catch (error) {
    console.error('Error fetching medical records stats:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas de expedientes' },
      { status: 500 }
    );
  }
}
