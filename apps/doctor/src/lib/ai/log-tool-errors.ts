/**
 * Non-blocking utility to persist assistant tool failures (audit A2).
 * Call without await so it never blocks the request path — same contract as
 * logTokenUsage. Rows carry error identity only, never tool inputs/results.
 */

import { prisma } from '@healthcare/database';
import type { ToolErrorRecord } from '@/lib/agenda-agent/run-turn';

interface LogToolErrorsParams {
  doctorId: string;
  endpoint: string; // e.g. "agenda-agent"
  errors: ToolErrorRecord[];
}

export function logToolErrors(params: LogToolErrorsParams): void {
  if (params.errors.length === 0) return;
  prisma.agentToolError
    .createMany({
      data: params.errors.map((e) => ({
        doctorId: params.doctorId,
        endpoint: params.endpoint,
        tool: e.tool,
        errorName: e.errorName,
        errorCode: e.errorCode,
        message: e.message,
      })),
    })
    .catch((err) => {
      console.error('[logToolErrors] Failed to log tool errors:', err);
    });
}
