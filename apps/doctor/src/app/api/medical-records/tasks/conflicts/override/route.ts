import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@healthcare/database';
import { requireDoctorAuth } from '@/lib/medical-auth';
import { handleApiError } from '@/lib/api-error-handler';

export async function POST(request: NextRequest) {
  try {
    const { doctorId } = await requireDoctorAuth(request);
    const body = await request.json();

    const { taskIdsToCancel = [], slotIdsToBlock = [] } = body;

    let cancelledTasks = 0;
    let blockedSlots = 0;
    const failedSlots: string[] = [];

    // 1. Block appointment slots FIRST (external system, more likely to fail)
    if (slotIdsToBlock.length > 0) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

      const results = await Promise.all(
        slotIdsToBlock.map(async (slotId: string) => {
          try {
            const res = await fetch(`${apiUrl}/api/appointments/slots/${slotId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'BLOCKED' }),
            });
            if (res.ok) {
              return { slotId, success: true };
            }
            console.error(`Failed to block slot ${slotId}: status ${res.status}`);
            return { slotId, success: false };
          } catch (error) {
            console.error(`Error blocking slot ${slotId}:`, error);
            return { slotId, success: false };
          }
        })
      );

      for (const r of results) {
        if (r.success) {
          blockedSlots++;
        } else {
          failedSlots.push(r.slotId);
        }
      }

      // If any slot failed to block, abort without cancelling tasks
      if (failedSlots.length > 0) {
        // Attempt to unblock the slots we already blocked (best-effort rollback)
        if (blockedSlots > 0) {
          const succeededSlots = results.filter(r => r.success).map(r => r.slotId);
          await Promise.all(
            succeededSlots.map(async (slotId) => {
              try {
                await fetch(`${apiUrl}/api/appointments/slots/${slotId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'AVAILABLE' }),
                });
              } catch {
                // Best-effort rollback
              }
            })
          );
        }

        return NextResponse.json({
          success: false,
          error: `No se pudieron bloquear ${failedSlots.length} horario(s) de citas. No se cancelaron pendientes para evitar inconsistencias.`,
          failedSlots,
        }, { status: 502 });
      }
    }

    // 2. Cancel conflicting tasks ONLY after all slots are blocked successfully
    if (taskIdsToCancel.length > 0) {
      const result = await prisma.task.updateMany({
        where: {
          id: { in: taskIdsToCancel },
          doctorId,
          status: { in: ['PENDIENTE', 'EN_PROGRESO'] },
        },
        data: {
          status: 'CANCELADA',
          completedAt: new Date(),
        },
      });
      cancelledTasks = result.count;
    }

    return NextResponse.json({
      success: true,
      cancelledTasks,
      blockedSlots,
    });
  } catch (error) {
    return handleApiError(error, 'overriding conflicts');
  }
}
