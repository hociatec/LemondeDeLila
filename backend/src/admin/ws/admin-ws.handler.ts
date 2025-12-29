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

@Injectable()
export class AdminWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly users: AdminUsersService,
    private readonly registry: GameRegistryService,
    private readonly overrides: GameCatalogOverridesService,
    private readonly categories: GameCategoriesService,
    private readonly notifications: NotificationService,
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
    private readonly roleDefinitions: RoleDefinitionsService,
    private readonly bots: BotService,
    private readonly botSettings: BotSettingsService,
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
}
