import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import {
  AdminClientUpdateAnnounceWsDto,
  AdminClientUpdateForceLatestWsDto,
  AdminClientUpdateScheduleWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminClientUpdatesWsHandler {
  private scheduledTimer: NodeJS.Timeout | null = null;
  private scheduledAtMs: number | null = null;

  constructor(
    private readonly validator: PayloadValidationService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async clientUpdateAnnounce(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminClientUpdateAnnounceWsDto,
      payload,
    );
    const latest = await this.clientUpdates.getLatest();

    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();
    const recipients = ids.filter((u) => u.id !== admin.id);

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
          'client.update.available',
          payloadOut,
        ),
      ),
    );

    return {
      type: 'admin.client.update.announce',
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

    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();
    const recipients = ids.filter((u) => u.id !== admin.id);

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
          'client.update.required',
          payloadOut,
        ),
      ),
    );

    return {
      type: 'admin.client.update.forceLatest',
      payload: {
        delivered: recipients.length,
        minRequiredVersion: latestVersion,
      },
    };
  }

  async clientUpdateSchedule(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminClientUpdateScheduleWsDto, payload);

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

    if (this.scheduledTimer) {
      clearTimeout(this.scheduledTimer);
      this.scheduledTimer = null;
    }

    const scheduledAtMs = Date.now() + delayMs;
    this.scheduledAtMs = scheduledAtMs;

    const imminentMessage =
      typeof dto.message === 'string' && dto.message.trim().length > 0
        ? dto.message.trim()
        : `Mise à jour du client planifiée dans ${Math.max(1, Math.round(effectiveDelaySeconds / 60))} minute(s).`;

    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();
    const recipients = ids.filter((u) => u.id !== admin.id);

    await Promise.all(
      recipients.map((u) =>
        this.notifications.notifyUser(u.id, 'client.update.imminent', {
          message: imminentMessage,
          etaSeconds: effectiveDelaySeconds,
          scheduledAt: new Date(scheduledAtMs).toISOString(),
          requiresAckDialog: true,
          fromUserId: admin.id,
          fromUsername: admin.username,
          timestamp: new Date().toISOString(),
        }),
      ),
    );

    this.scheduledTimer = setTimeout(async () => {
      try {
        if (this.scheduledAtMs !== scheduledAtMs) return;

        const latest = await this.clientUpdates.getLatest();
        const url = this.clientUpdates.resolveClientPublicUrl(latest);
        const version = latest?.version?.trim() || null;

        await Promise.all(
          recipients.map((u) =>
            this.notifications.notifyUser(u.id, 'client.update.available', {
              message:
                latest?.message ??
                'Une mise à jour du client est disponible et va être installée automatiquement.',
              version,
              url,
              fromUserId: admin.id,
              fromUsername: admin.username,
              timestamp: new Date().toISOString(),
            }),
          ),
        );
      } catch {
        // ignore
      }
    }, delayMs);

    return {
      type: 'admin.client.update.schedule',
      payload: {
        delivered: recipients.length,
        scheduledAt: new Date(scheduledAtMs).toISOString(),
        delaySeconds: effectiveDelaySeconds,
      },
    };
  }
}
