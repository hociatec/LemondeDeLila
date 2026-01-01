import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { RoleDefinitionsService } from '../services/role-definitions.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { ClientUpdatesService } from '../../client-updates/client-updates.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  AdminBroadcastWsDto,
  AdminClientUpdateAnnounceWsDto,
  AdminClientUpdateForceLatestWsDto,
  AdminLogsDownloadWsDto,
  AdminRoleDefinitionCreateWsDto,
  AdminRoleDefinitionDeleteWsDto,
  AdminRoleDefinitionUpdateWsDto,
  AdminRolesListWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly config: ConfigService,
    private readonly roleDefinitions: RoleDefinitionsService,
    private readonly perf: PerfMetricsService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async rolesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminRolesListWsDto, payload ?? {});
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.list',
      payload: {
        roles: definitions.map((d) => d.name),
        definitions,
      },
    };
  }

  async rolesDefinitionsList(session: WsSession) {
    requireAdmin(session);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  // Rooms WS endpoints were extracted to AdminRoomsWsHandler.

  async perfSnapshot(session: WsSession, payload: any) {
    requireAdmin(session);
    const windowSeconds =
      payload && typeof payload === 'object' ? payload.windowSeconds : undefined;
    const snapshot = this.perf.snapshot({ windowSeconds });
    return { type: 'admin.perf.snapshot', payload: snapshot };
  }

  async roleDefinitionCreate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionCreateWsDto, payload);
    await this.roleDefinitions.create({
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  async roleDefinitionUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionUpdateWsDto, payload);
    await this.roleDefinitions.update(dto.name, {
      name: dto.newName,
      description: dto.description,
      permissions: dto.permissions,
    });
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  async roleDefinitionDelete(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminRoleDefinitionDeleteWsDto, payload);
    await this.roleDefinitions.delete(dto.name);
    await this.catalogInvalidation.notifyCatalogInvalidated(admin.id);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  async logsDownload(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminLogsDownloadWsDto, payload ?? {}) as AdminLogsDownloadWsDto;
    const linesCount = dto.lines ?? 200;
    const filter = dto.filter?.trim() ?? '';
    const logDir = this.config.get<string>('LOG_DIR') ?? 'log';
    const resolvedDir = path.resolve(logDir);
    let entries: string[];
    try {
      entries = await fs.promises.readdir(resolvedDir);
    } catch {
      throw new BadRequestException('Répertoire de logs introuvable');
    }
    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.toLowerCase().endsWith('.log'))
        .map(async (entry) => ({
          entry,
          stat: await fs.promises.stat(path.join(resolvedDir, entry)),
        })),
    );
    if (!candidates.length) {
      throw new BadRequestException('Aucun fichier log disponible');
    }
    candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const latest = candidates[0];
    const content = await fs.promises.readFile(
      path.join(resolvedDir, latest.entry),
      'utf-8',
    );
    const lines = content.split(/\r?\n/);
    const filtered = filter
      ? lines.filter((line) => line.includes(filter))
      : lines;
    const tail = filtered.slice(-linesCount);
    return {
      type: 'admin.logs.download',
      payload: {
        file: latest.entry,
        lines: tail,
        total: filtered.length,
      },
    };
  }

  async broadcast(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminBroadcastWsDto, payload);
    const message = dto.message.trim();

    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();

    const payloadOut = {
      message,
      fromUserId: admin.id,
      fromUsername: admin.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      ids.map((u) => this.notifications.notifyUser(u.id, 'admin.broadcast', payloadOut)),
    );

    return { type: 'admin.broadcast', payload: { delivered: ids.length } };
  }

  async clientUpdateAnnounce(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminClientUpdateAnnounceWsDto, payload);

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
      version: dto.version?.trim() || null,
      fromUserId: admin.id,
      fromUsername: admin.username,
      timestamp: new Date().toISOString(),
    };

    await Promise.all(
      recipients.map((u) =>
        this.notifications.notifyUser(u.id, 'client.update.available', payloadOut),
      ),
    );

    return {
      type: 'admin.client.update.announce',
      payload: { delivered: recipients.length },
    };
  }

  async clientUpdateForceLatest(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminClientUpdateForceLatestWsDto, payload ?? {});

    const latest = await this.clientUpdates.getLatest();
    const latestVersion = latest?.version?.trim() || null;
    if (!latestVersion) {
      throw new BadRequestException(
        "Impossible de forcer la mise à jour : aucune version publiée (latest.json manquant).",
      );
    }

    const message =
      typeof dto.message === 'string' && dto.message.trim().length > 0
        ? dto.message.trim()
        : 'Une mise à jour du client est requise pour continuer.';

    await this.clientUpdates.saveLatest({
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
        this.notifications.notifyUser(u.id, 'client.update.required', payloadOut),
      ),
    );

    return {
      type: 'admin.client.update.forceLatest',
      payload: { delivered: recipients.length, minRequiredVersion: latestVersion },
    };
  }
}
