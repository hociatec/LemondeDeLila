import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AdminClientUpdatesSharedService } from './admin-client-updates-shared.service';
import {
  AdminClientUpdateSchedulePlannerService,
  type AdminClientUpdateSchedulePlan,
} from './admin-client-update-schedule-planner.service';
import { AdminClientUpdateSchedulerDispatchService } from './admin-client-update-scheduler-dispatch.service';
import type { AdminClientUpdateScheduleCommand } from './admin-client-updates.types';
import { operationalPolicy } from '../../../../config/public-api';
import type { AdminNotificationPort } from '../../ports/admin-notification.port';
import type { AdminClientUpdatesPort } from '../../ports/admin-client-updates.port';

@Injectable()
export class AdminClientUpdateSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(AdminClientUpdateSchedulerService.name);
  private scheduledTimer: NodeJS.Timeout | null = null;
  private scheduledAtMs: number | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private warningAtMs: number | null = null;

  constructor(
    private readonly shared: AdminClientUpdatesSharedService,
    private readonly planner: AdminClientUpdateSchedulePlannerService,
    private readonly dispatch: AdminClientUpdateSchedulerDispatchService,
  ) {}

  onModuleDestroy(): void {
    this.clearScheduledTimers();
  }

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

    const sendImminentNotification = () =>
      this.sendImminent(command, recipientIds, notifications, plan);

    if (plan.warningDelayMs <= 0) {
      void sendImminentNotification();
    } else {
      this.warningTimer = setTimeout(
        () => void sendImminentNotification(),
        plan.warningDelayMs,
      );
    }

    const sendForcedUpdate = () =>
      this.sendForced(
        command,
        recipientIds,
        notifications,
        clientUpdates,
        plan,
      );

    this.scheduledTimer = setTimeout(
      () => void sendForcedUpdate(),
      plan.delayMs,
    );

    return scheduleResult(
      recipientIds.length,
      plan.scheduledAtMs,
      plan.effectiveDelaySeconds,
    );
  }

  private async sendImminent(
    command: AdminClientUpdateScheduleCommand,
    recipientIds: number[],
    notifications: AdminNotificationPort,
    plan: AdminClientUpdateSchedulePlan,
  ): Promise<void> {
    if (this.warningAtMs !== plan.scheduledAtMs) return;
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
    } catch (error) {
      this.logger.warn(
        `Notification de mise à jour imminente non diffusée: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async sendForced(
    command: AdminClientUpdateScheduleCommand,
    recipientIds: number[],
    notifications: AdminNotificationPort,
    clientUpdates: AdminClientUpdatesPort,
    plan: AdminClientUpdateSchedulePlan,
  ): Promise<void> {
    if (this.scheduledAtMs !== plan.scheduledAtMs) return;
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
    } catch (error) {
      this.logger.error(
        `Mise à jour forcée non diffusée: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, operationalPolicy.clientUpdateDisconnectDelayMs),
    );
    notifications.disconnectAll('Mise à jour en cours.');
    this.scheduledAtMs = null;
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

function scheduleResult(
  delivered: number,
  scheduledAtMs: number,
  delaySeconds: number,
) {
  return {
    delivered,
    scheduledAt: new Date(scheduledAtMs).toISOString(),
    delaySeconds,
  };
}
