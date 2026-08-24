import { Injectable } from '@nestjs/common';
import { AdminClientUpdatesSharedService } from './admin-client-updates-shared.service';
import { AdminClientUpdateSchedulePlannerService } from './admin-client-update-schedule-planner.service';
import { AdminClientUpdateSchedulerDispatchService } from './admin-client-update-scheduler-dispatch.service';
import type { AdminClientUpdateScheduleCommand } from './admin-client-updates.types';

@Injectable()
export class AdminClientUpdateSchedulerService {
  private scheduledTimer: NodeJS.Timeout | null = null;
  private scheduledAtMs: number | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private warningAtMs: number | null = null;

  constructor(
    private readonly shared: AdminClientUpdatesSharedService,
    private readonly planner: AdminClientUpdateSchedulePlannerService,
    private readonly dispatch: AdminClientUpdateSchedulerDispatchService,
  ) {}

  async schedule(
    command: AdminClientUpdateScheduleCommand,
  ): Promise<{ delivered: number; scheduledAt: string; delaySeconds: number }> {
    const plan = this.planner.createPlan(command);
    const recipientIds = await this.shared.listRecipientIds();
    const notifications = this.shared.getNotificationService();
    const clientUpdates = this.shared.getClientUpdatesService();
    this.clearScheduledTimers();

    this.scheduledAtMs = plan.scheduledAtMs;
    this.warningAtMs = plan.scheduledAtMs;

    const sendImminentNotification = async () => {
      if (this.warningAtMs !== plan.scheduledAtMs) {
        return;
      }
      this.warningTimer = null;
      this.warningAtMs = null;
      try {
        await this.dispatch.sendImminentNotification({
          command,
          recipientIds,
          notifications,
          scheduledAtMs: plan.scheduledAtMs,
          imminentMessage: plan.imminentMessage,
        });
      } catch {
        // ignore
      }
    };

    if (plan.warningDelayMs <= 0) {
      void sendImminentNotification();
    } else {
      this.warningTimer = setTimeout(
        () => void sendImminentNotification(),
        plan.warningDelayMs,
      );
    }

    const sendForcedUpdate = async () => {
      if (this.scheduledAtMs !== plan.scheduledAtMs) {
        return;
      }
      this.scheduledTimer = null;
      try {
        const delivered = await this.dispatch.sendForcedUpdate({
          command,
          recipientIds,
          notifications,
          clientUpdates,
        });
        if (!delivered) {
          this.scheduledAtMs = null;
          return;
        }
      } catch {
        // ignore
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
      notifications.disconnectAll('Mise à jour en cours.');
      this.scheduledAtMs = null;
    };

    this.scheduledTimer = setTimeout(
      () => void sendForcedUpdate(),
      plan.delayMs,
    );

    return {
      delivered: recipientIds.length,
      scheduledAt: new Date(plan.scheduledAtMs).toISOString(),
      delaySeconds: plan.effectiveDelaySeconds,
    };
  }

  private clearScheduledTimers(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
      this.warningAtMs = null;
    }
    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
      this.scheduledAtMs = null;
    }
  }
}
