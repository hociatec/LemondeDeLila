import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../../../common/ws/ws-auth';
import type { WsSession } from '../../../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../../../common/validation/payload-validation.service';
import { NotificationService } from '../../../../notification/services/notification.service';
import { User } from '../../../../user/entities/user.entity';
import { ClientUpdatesService } from '../../../../client-updates/services/client-updates.service';
import { parseVersion } from '../../../../common/utils/version.utils';
import { WS_EVENTS } from '../../../../common/ws/ws-events';
import {
  AdminClientUpdateAnnounceWsDto,
  AdminClientUpdateForceLatestWsDto,
  AdminClientUpdateScheduleWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminClientUpdatesWsHandler {
  private scheduledTimer: NodeJS.Timeout | null = null;
  private scheduledAtMs: number | null = null;
  private warningTimer: NodeJS.Timeout | null = null;
  private warningAtMs: number | null = null;

  constructor(
    private readonly validator: PayloadValidationService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async listRecipientIds(): Promise<Array<{ id: number }>> {
    return this.userRepo.createQueryBuilder('u').select(['u.id']).getMany();
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

  async clientUpdateAnnounce(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateAnnounceWsDto,
      payload,
    );
    const latest = await this.clientUpdates.getLatest();

    const recipients = await this.listRecipientIds();

    const message =
      typeof dto.message === 'string' && dto.message.trim().length > 0
        ? dto.message.trim()
        : 'Une mise à jour du client est disponible.';

    const payloadOut = {
      message,
      // Robustesse: toujours diffuser la version réellement publiée côté serveur.
      version: latest?.version?.trim() || dto.version?.trim() || null,
      fromUserId: admin.id,
      fromUsername: admin.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      recipients.map((u) =>
        this.notifications.notifyUser(
          u.id,
          WS_EVENTS.clientUpdate.available,
          payloadOut,
        ),
      ),
    );

    return {
      type: WS_EVENTS.admin.clientUpdate.announce,
      payload: { delivered: recipients.length },
    };
  }

  async clientUpdateForceLatest(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateForceLatestWsDto,
      payload ?? {},
    );

    const latest = await this.clientUpdates.getLatest();
    const publishedClickOnce =
      await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
    const latestVersion =
      (publishedClickOnce || latest?.version || '').trim() || null;
    if (!latestVersion) {
      throw new BadRequestException(
        'Impossible de forcer la mise à jour : aucune version publiée (latest.json manquant).',
      );
    }

    const message =
      typeof dto.message === 'string' && dto.message.trim().length > 0
        ? dto.message.trim()
        : 'Une mise à jour du client est requise pour continuer.';

    await this.clientUpdates.saveLatest({
      // Keep the metadata version aligned with what clients can actually download.
      version: latestVersion,
      publishedAt: latest?.publishedAt ?? new Date().toISOString(),
      message: latest?.message ?? null,
      publicUrl: latest?.publicUrl ?? null,
      minRequiredVersion: latestVersion,
    });

    const recipients = await this.listRecipientIds();

    const url = this.clientUpdates.resolveClientPublicUrl(latest);
    const payloadOut = {
      minRequiredVersion: latestVersion,
      currentVersion: null,
      message,
      publishedAt: latest?.publishedAt ?? null,
      url,
      fromUserId: admin.id,
      fromUsername: admin.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      recipients.map((u) =>
        this.notifications.notifyUser(
          u.id,
          WS_EVENTS.clientUpdate.required,
          payloadOut,
        ),
      ),
    );

    return {
      type: WS_EVENTS.admin.clientUpdate.forceLatest,
      payload: {
        delivered: recipients.length,
        minRequiredVersion: latestVersion,
      },
    };
  }

  async clientUpdateSchedule(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateScheduleWsDto,
      payload,
    );

    const minutesFromDto =
      typeof dto.delayMinutes === 'number' && Number.isFinite(dto.delayMinutes)
        ? dto.delayMinutes
        : null;
    const secondsFromDto =
      typeof dto.delaySeconds === 'number' && Number.isFinite(dto.delaySeconds)
        ? dto.delaySeconds
        : null;
    const effectiveDelaySeconds =
      minutesFromDto != null
        ? Math.max(60, Math.round(minutesFromDto * 60))
        : Math.max(60, Math.round(secondsFromDto ?? 60));
    const delayMs = effectiveDelaySeconds * 1000;

    const recipients = await this.listRecipientIds();
    this.clearScheduledTimers();

    const scheduledAtMs = Date.now() + delayMs;
    this.scheduledAtMs = scheduledAtMs;

    const warningLeadMs = 5 * 60 * 1000;
    const warningDelayMs = Math.max(0, delayMs - warningLeadMs);
    this.warningAtMs = scheduledAtMs;

    const imminentMessageBase =
      typeof dto.message === 'string' && dto.message.trim().length > 0
        ? dto.message.trim()
        : null;
    const defaultImminentMessage =
      delayMs >= warningLeadMs
        ? 'Mise à jour imminante dans cinq minutes.'
        : `Mise à jour imminante dans ${Math.max(
            1,
            Math.round(delayMs / 60_000),
          )} minute(s).`;
    const imminentMessage = imminentMessageBase ?? defaultImminentMessage;
    const fromUserId = admin.id;
    const fromUsername = admin.username;

    const sendImminentNotification = async () => {
      if (this.warningAtMs !== scheduledAtMs) return;
      this.warningTimer = null;
      this.warningAtMs = null;
      try {
        const now = Date.now();
        const etaSeconds = Math.max(
          0,
          Math.round((scheduledAtMs - now) / 1000),
        );
        await Promise.all(
          recipients.map((u) =>
            this.notifications.notifyUser(u.id, WS_EVENTS.clientUpdate.imminent, {
              message: imminentMessage,
              etaSeconds,
              scheduledAt: new Date(scheduledAtMs).toISOString(),
              requiresAckDialog: true,
              fromUserId,
              fromUsername,
              timestamp: new Date().toISOString(),
            }),
          ),
        );
      } catch {
        // ignore
      }
    };

    if (warningDelayMs <= 0) {
      void sendImminentNotification();
    } else {
      this.warningTimer = setTimeout(
        () => void sendImminentNotification(),
        warningDelayMs,
      );
    }

    const sendForcedUpdate = async () => {
      if (this.scheduledAtMs !== scheduledAtMs) return;
      this.scheduledTimer = null;
      try {
        const latest = await this.clientUpdates.getLatest();
        const publishedClickOnce =
          await this.clientUpdates.getPublishedClickOnceVersionFromDisk();
        const latestVersion =
          (publishedClickOnce || latest?.version || '').trim() || null;
        if (!latestVersion || parseVersion(latestVersion) == null) {
          // Sécurité: ne jamais déconnecter tout le monde si aucune version ClickOnce valide n'est publiée.
          this.scheduledAtMs = null;
          return;
        }

        await this.clientUpdates.saveLatest({
          version: latestVersion,
          publishedAt: latest?.publishedAt ?? new Date().toISOString(),
          message: latest?.message ?? null,
          publicUrl: latest?.publicUrl ?? null,
          minRequiredVersion: latestVersion,
        });

        const url = this.clientUpdates.resolveClientPublicUrl(latest);

        await Promise.all(
          recipients.map((u) =>
            this.notifications.notifyUser(u.id, WS_EVENTS.clientUpdate.required, {
              message:
                latest?.message ??
                'Une mise à jour du client est requise pour continuer.',
              minRequiredVersion: latestVersion,
              currentVersion: null,
              publishedAt: latest?.publishedAt ?? null,
              url,
              fromUserId,
              fromUsername,
              timestamp: new Date().toISOString(),
            }),
          ),
        );
      } catch {
        // ignore
      }
      // Laisser un court délai pour que les clients reçoivent/traitent le signal de mise à jour
      // avant la fermeture WS forcée.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      this.notifications.disconnectAll('Mise à jour en cours.');
      this.scheduledAtMs = null;
    };

    this.scheduledTimer = setTimeout(() => void sendForcedUpdate(), delayMs);

    return {
      type: WS_EVENTS.admin.clientUpdate.schedule,
      payload: {
        delivered: recipients.length,
        scheduledAt: new Date(scheduledAtMs).toISOString(),
        delaySeconds: effectiveDelaySeconds,
      },
    };
  }
}






