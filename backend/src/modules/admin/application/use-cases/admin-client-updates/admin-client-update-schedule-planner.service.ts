import { Injectable } from '@nestjs/common';
import type { AdminClientUpdateScheduleCommand } from './admin-client-updates.types';

export interface AdminClientUpdateSchedulePlan {
  effectiveDelaySeconds: number;
  delayMs: number;
  scheduledAtMs: number;
  warningDelayMs: number;
  imminentMessage: string;
}

@Injectable()
export class AdminClientUpdateSchedulePlannerService {
  createPlan(
    command: AdminClientUpdateScheduleCommand,
    nowMs = Date.now(),
  ): AdminClientUpdateSchedulePlan {
    const minutesFromCommand =
      typeof command.delayMinutes === 'number' &&
      Number.isFinite(command.delayMinutes)
        ? command.delayMinutes
        : null;
    const secondsFromCommand =
      typeof command.delaySeconds === 'number' &&
      Number.isFinite(command.delaySeconds)
        ? command.delaySeconds
        : null;
    const effectiveDelaySeconds =
      minutesFromCommand != null
        ? Math.max(60, Math.round(minutesFromCommand * 60))
        : Math.max(60, Math.round(secondsFromCommand ?? 60));
    const delayMs = effectiveDelaySeconds * 1000;
    const scheduledAtMs = nowMs + delayMs;
    const warningLeadMs = 5 * 60 * 1000;
    const warningDelayMs = Math.max(0, delayMs - warningLeadMs);

    const imminentMessageBase =
      typeof command.message === 'string' && command.message.trim().length > 0
        ? command.message.trim()
        : null;
    const defaultImminentMessage =
      delayMs >= warningLeadMs
        ? 'Mise à jour imminente dans cinq minutes.'
        : `Mise à jour imminente dans ${Math.max(
            1,
            Math.round(delayMs / 60_000),
          )} minute(s).`;

    return {
      effectiveDelaySeconds,
      delayMs,
      scheduledAtMs,
      warningDelayMs,
      imminentMessage: imminentMessageBase ?? defaultImminentMessage,
    };
  }
}
