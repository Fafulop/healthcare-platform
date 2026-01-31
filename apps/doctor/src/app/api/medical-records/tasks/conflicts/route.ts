import { NextRequest, NextResponse } from 'next/server';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';
import { checkConflictsForEntry, ConflictEntry } from '@/lib/conflict-checker';

// GET - single conflict check
export async function GET(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const excludeTaskId = searchParams.get('excludeTaskId');

    if (!date || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'date, startTime y endTime son requeridos' },
        { status: 400 }
      );
    }

    const result = await checkConflictsForEntry(
      doctorId,
      { date, startTime, endTime },
      excludeTaskId || undefined
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error, 'checking task conflicts');
  }
}

// POST - batch conflict check
export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const entries: ConflictEntry[] = body.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: 'entries array es requerido' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      entries.map(async (entry, index) => {
        const result = await checkConflictsForEntry(doctorId, entry);
        return { index, ...result };
      })
    );

    return NextResponse.json({ data: { results } });
  } catch (error) {
    return handleApiError(error, 'batch checking task conflicts');
  }
}
