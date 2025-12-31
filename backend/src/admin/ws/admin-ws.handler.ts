import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { AdminUsersService } from '../services/admin-users.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { GameCatalogOverridesService } from '../../game/engine/services/game-catalog-overrides.service';
import { GameCategoriesService } from '../../game/engine/services/game-categories.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';
import { CatalogService } from '../../catalog/services/catalog.service';
import { RoleDefinitionsService } from '../services/role-definitions.service';
import { BotService } from '../../bot/services/bot.service';
import { BotSettingsService } from '../../game/modules/bot/services/bot-settings.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { ClientUpdatesService } from '../../client-updates/client-updates.service';
import { ChatService } from '../../chat/services/chat.service';
import { RoomService } from '../../room/services/room.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  AdminBanUserWsDto,
  AdminBotNameCreateWsDto,
  AdminBotNameDeleteWsDto,
  AdminBotNameUpdateWsDto,
  AdminBotNamesListWsDto,
  AdminBotSettingsGetWsDto,
  AdminBotSettingsUpdateWsDto,
  AdminBroadcastWsDto,
  AdminClientUpdateAnnounceWsDto,
  AdminClientUpdateForceLatestWsDto,
  AdminChatBanWsDto,
  AdminChatClearWsDto,
  AdminChatDeleteWsDto,
  AdminChatMessagesWsDto,
  AdminChatUnbanWsDto,
  AdminGameCategoryAssignWsDto,
  AdminGameCategoryCreateWsDto,
  AdminGameCategoryUpdateWsDto,
  AdminGameCategoriesListWsDto,
  AdminGameResetWsDto,
  AdminGameSetEnabledWsDto,
  AdminGameUpdateWsDto,
  AdminListUsersWsDto,
  AdminLogsDownloadWsDto,
  AdminRoleDefinitionCreateWsDto,
  AdminRoleDefinitionDeleteWsDto,
  AdminRoleDefinitionUpdateWsDto,
  AdminRolesListWsDto,
  AdminUserIdWsDto,
  AdminUserRolesWsDto,
} from './admin-ws.dto';
import { AdminRoomsCleanupWsDto } from './admin-rooms-cleanup.dto';

@Injectable()
export class AdminWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly users: AdminUsersService,
    private readonly registry: GameRegistryService,
    private readonly overrides: GameCatalogOverridesService,
    private readonly categories: GameCategoriesService,
    private readonly notifications: NotificationService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly chat: ChatService,
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
    private readonly roleDefinitions: RoleDefinitionsService,
    private readonly bots: BotService,
    private readonly botSettings: BotSettingsService,
    private readonly perf: PerfMetricsService,
    private readonly rooms: RoomService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async notifyCatalogInvalidated(adminId: number) {
    const ids = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id'])
      .getMany();

    await Promise.all(
      ids.map((u) =>
        this.notifications.notifyUser(u.id, 'catalog.invalidate', {
          byUserId: adminId,
          timestamp: new Date().toISOString(),
        }),
      ),
    );
  }

  private buildCategoriesPayload() {
    return {
      categories: this.categories.getCategories(),
      assignments: this.categories.listAssignments(),
    };
  }

  private async refreshCatalog(adminId: number) {
    this.registry.invalidateCache();
    await this.catalog.clearCache();
    await this.notifyCatalogInvalidated(adminId);
  }

  async usersList(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminListUsersWsDto, payload);
    const result = await this.users.list(dto as any);
    return { type: 'admin.users.list', payload: result };
  }

  async usersGet(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const user = await this.users.get(dto.id);
    return { type: 'admin.users.get', payload: { user } };
  }

  async usersBan(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBanUserWsDto, payload);
    const res = await this.users.ban(
      dto.id,
      dto.reason,
      dto.durationDays,
      dto.bannedUntil ?? null,
    );
    return { type: 'admin.users.ban', payload: res };
  }

  async usersUnban(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.unban(dto.id);
    return { type: 'admin.users.unban', payload: res };
  }

  async usersDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminUserIdWsDto, payload);
    const res = await this.users.delete(dto.id);
    return { type: 'admin.users.delete', payload: res };
  }

  async gamesList(session: WsSession) {
    requireAdmin(session);
    const games = await this.registry.listGames({
      includeDisabledOverrides: true,
    });
    const payload = games
      .map((g) => {
        const ov = this.overrides.getGameOverride(g.id);
        const enabled = ov?.enabled !== false;
        const categoryId = this.categories.getAssignment(g.id);
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          categoryId: categoryId ?? undefined,
          subcategory: g.subcategory,
          description: g.description,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          enabled,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { type: 'admin.games.list', payload: { games: payload } };
  }

  async gamesCategoriesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminGameCategoriesListWsDto, payload ?? {});
    return { type: 'admin.games.categories', payload: this.buildCategoriesPayload() };
  }

  async gamesCategoryCreate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryCreateWsDto, payload);
    await this.categories.createCategory(dto.name, dto.parentId ?? null);
    await this.refreshCatalog(admin.id);
    return { type: 'admin.games.categories', payload: this.buildCategoriesPayload() };
  }

  async gamesCategoryUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryUpdateWsDto, payload);
    await this.categories.updateCategory(dto.id, {
      name: dto.name,
      parentId: dto.parentId ?? null,
    });
    await this.refreshCatalog(admin.id);
    return { type: 'admin.games.categories', payload: this.buildCategoriesPayload() };
  }

  async gamesCategoryAssign(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryAssignWsDto, payload);
    await this.categories.assignCategory(dto.gameType, dto.categoryId ?? null);
    await this.refreshCatalog(admin.id);
    return { type: 'admin.games.category.assign', payload: this.buildCategoriesPayload() };
  }

  async gamesSetEnabled(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameSetEnabledWsDto, payload) as AdminGameSetEnabledWsDto;
    await this.overrides.setEnabled(dto.gameType, dto.enabled);
    this.registry.invalidateCache();
    await this.catalog.clearCache();
    await this.notifyCatalogInvalidated(admin.id);
    return { type: 'admin.games.setEnabled', payload: { ok: true } };
  }

  async gamesUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameUpdateWsDto, payload) as AdminGameUpdateWsDto;
    await this.overrides.updateGameOverride(dto.gameType, {
      enabled: dto.enabled,
      minPlayers: dto.minPlayers,
      maxPlayers: dto.maxPlayers,
      name: dto.name,
      description: dto.description,
    });
    this.registry.invalidateCache();
    await this.catalog.clearCache();
    await this.notifyCatalogInvalidated(admin.id);
    return { type: 'admin.games.update', payload: { ok: true } };
  }

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

  async roomsCleanup(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminRoomsCleanupWsDto, payload);
    if (dto.confirm !== true) {
      throw new BadRequestException('Confirmation requise.');
    }
    const res = await this.rooms.adminCleanupRooms({
      includePrivate: dto.includePrivate === true,
      includeStarted: dto.includeStarted === true,
      olderThanMinutes: dto.olderThanMinutes,
      limit: dto.limit,
      dryRun: dto.dryRun === true,
    });
    return { type: 'admin.rooms.cleanup', payload: res };
  }

  async botsNamesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminBotNamesListWsDto, payload ?? {});
    const names = await this.bots.listBotNames();
    return {
      type: 'admin.bots.names.list',
      payload: {
        names: names.map((n) => ({
          id: n.id,
          name: n.name,
          enabled: n.enabled,
          createdAt: n.createdAt,
        })),
      },
    };
  }

  async botSettingsGet(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminBotSettingsGetWsDto, payload ?? {});
    return {
      type: 'admin.bots.settings.get',
      payload: this.botSettings.getSettings(),
    };
  }

  async botSettingsUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotSettingsUpdateWsDto, payload);
    const updated = await this.botSettings.updateSettings({
      botTurnDelayMs: dto.botTurnDelayMs,
    });
    return { type: 'admin.bots.settings.update', payload: updated };
  }

  async botNameCreate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameCreateWsDto, payload);
    await this.bots.createBotName(dto.name, dto.enabled ?? true);
    const names = await this.bots.listBotNames();
    return {
      type: 'admin.bots.names.list',
      payload: {
        names: names.map((n) => ({
          id: n.id,
          name: n.name,
          enabled: n.enabled,
          createdAt: n.createdAt,
        })),
      },
    };
  }

  async botNameUpdate(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameUpdateWsDto, payload);
    await this.bots.updateBotName(dto.id, {
      name: dto.name,
      enabled: dto.enabled,
    });
    const names = await this.bots.listBotNames();
    return {
      type: 'admin.bots.names.list',
      payload: {
        names: names.map((n) => ({
          id: n.id,
          name: n.name,
          enabled: n.enabled,
          createdAt: n.createdAt,
        })),
      },
    };
  }

  async botNameDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminBotNameDeleteWsDto, payload);
    await this.bots.deleteBotName(dto.id);
    const names = await this.bots.listBotNames();
    return {
      type: 'admin.bots.names.list',
      payload: {
        names: names.map((n) => ({
          id: n.id,
          name: n.name,
          enabled: n.enabled,
          createdAt: n.createdAt,
        })),
      },
    };
  }

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
    await this.notifyCatalogInvalidated(admin.id);
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
    await this.notifyCatalogInvalidated(admin.id);
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
    await this.notifyCatalogInvalidated(admin.id);
    const definitions = await this.roleDefinitions.list();
    return {
      type: 'admin.roles.definitions',
      payload: { definitions },
    };
  }

  async usersUpdateRoles(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminUserRolesWsDto, payload);
    const user = await this.users.update(dto.id, { roles: dto.roles });
    await this.catalog.clearCache();
    this.registry.invalidateCache();
    await this.notifyCatalogInvalidated(admin.id);
    return { type: 'admin.users.rolesUpdated', payload: { user } };
  }

  async gamesReset(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameResetWsDto, payload) as AdminGameResetWsDto;
    await this.overrides.clearGameOverride(dto.gameType);
    this.registry.invalidateCache();
    await this.catalog.clearCache();
    await this.notifyCatalogInvalidated(admin.id);
    return { type: 'admin.games.reset', payload: { ok: true } };
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

  async chatMessages(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatMessagesWsDto, payload);
    const rows = await this.chat.adminListMessages(
      dto.limit ?? 200,
      dto.includeDeleted ?? false,
    );
    const messages = rows.map((m) => ({
      id: m.messageId,
      text: m.message,
      createdAt:
        m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
      user: {
        id: m.user?.id ?? null,
        username: m.user?.username ?? null,
        avatar: m.user?.avatar ?? null,
        chatBannedUntil: m.user?.chatBannedUntil
          ? (m.user.chatBannedUntil instanceof Date
              ? m.user.chatBannedUntil.toISOString()
              : null)
          : null,
        chatBanReason: m.user?.chatBanReason ?? null,
      },
    }));
    return { type: 'admin.chat.messages', payload: { messages } };
  }

  async chatDelete(session: WsSession, payload: any) {
    requireAdmin(session);
    const dto = this.validator.validate(AdminChatDeleteWsDto, payload);
    const ok = await this.chat.adminDeleteMessage(dto.messageId);
    return { type: 'admin.chat.delete', payload: { ok } };
  }

  async chatClear(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminChatClearWsDto, payload);
    const deleted = await this.chat.adminClearAll();
    return { type: 'admin.chat.clear', payload: { deleted } };
  }

  async chatBan(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatBanWsDto, payload);
    const user = await this.userRepo.findOne({ where: { id: dto.id } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    const days = dto.durationDays && dto.durationDays > 0 ? dto.durationDays : 3650;
    const until = new Date(Date.now() + days * 24 * 60 * 60_000);
    user.chatBannedUntil = until;
    user.chatBanReason = (dto.reason || '').trim() || null;
    await this.userRepo.save(user);

    return {
      type: 'admin.chat.ban',
      payload: {
        ok: true,
        userId: user.id,
        chatBannedUntil: until.toISOString(),
        chatBanReason: user.chatBanReason,
        byUserId: admin.id,
      },
    };
  }

  async chatUnban(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminChatUnbanWsDto, payload);
    const user = await this.userRepo.findOne({ where: { id: dto.id } });
    if (!user) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    user.chatBannedUntil = null;
    user.chatBanReason = null;
    await this.userRepo.save(user);
    return {
      type: 'admin.chat.unban',
      payload: { ok: true, userId: user.id, byUserId: admin.id },
    };
  }
}
