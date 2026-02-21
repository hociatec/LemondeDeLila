import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { GameCategoriesService } from '../../game/engine/services/game-categories.service';
import { GameCatalogOverridesService } from '../../game/engine/services/game-catalog-overrides.service';
import type { GameCatalogOverride } from '../../game/engine/services/game-catalog-overrides.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
import {
  AdminGameCategoryAssignWsDto,
  AdminGameCategoryCreateWsDto,
  AdminGameCategoryDeleteWsDto,
  AdminGameCategoryUpdateWsDto,
  AdminGameCategoriesListWsDto,
  AdminGameResetWsDto,
  AdminGameSetEnabledWsDto,
  AdminGameUpdateWsDto,
} from './admin-ws.dto';

@Injectable()
export class AdminGamesWsHandler {
  constructor(
    private readonly validator: PayloadValidationService,
    private readonly registry: GameRegistryService,
    private readonly overrides: GameCatalogOverridesService,
    private readonly categories: GameCategoriesService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  private buildCategoriesPayload() {
    return {
      categories: this.categories.getCategories(),
      assignments: this.categories.listAssignments(),
    };
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
        const chatEnabled =
          typeof ov?.chatEnabled === 'boolean'
            ? ov.chatEnabled
            : typeof g.chatEnabled === 'boolean'
              ? g.chatEnabled
              : true;
        const chatSoundsEnabled =
          typeof ov?.chatSoundsEnabled === 'boolean'
            ? ov.chatSoundsEnabled
            : typeof g.chatSoundsEnabled === 'boolean'
              ? g.chatSoundsEnabled
              : true;
        const status = ov?.status ?? 'finished';
        const categoryId = this.categories.getAssignment(g.id);
        return {
          id: g.id,
          name: g.name,
          category: g.category,
          categoryId: categoryId ?? undefined,
          subcategory: g.subcategory,
          description: g.description,
          rules: ov?.rules ?? undefined,
          minPlayers: g.minPlayers,
          maxPlayers: g.maxPlayers,
          enabled,
          status,
          chatEnabled,
          chatSoundsEnabled,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { type: 'admin.games.list', payload: { games: payload } };
  }

  gamesCategoriesList(session: WsSession, payload: any) {
    requireAdmin(session);
    this.validator.validate(AdminGameCategoriesListWsDto, payload ?? {});
    return {
      type: 'admin.games.categories',
      payload: this.buildCategoriesPayload(),
    };
  }

  async gamesCategoryCreate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryCreateWsDto, payload);
    await this.categories.createCategory(dto.name, dto.parentId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return {
      type: 'admin.games.categories',
      payload: this.buildCategoriesPayload(),
    };
  }

  async gamesCategoryUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryUpdateWsDto, payload);
    await this.categories.updateCategory(dto.id, {
      name: dto.name,
      parentId: dto.parentId ?? null,
    });
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return {
      type: 'admin.games.categories',
      payload: this.buildCategoriesPayload(),
    };
  }

  async gamesCategoryAssign(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryAssignWsDto, payload);
    await this.categories.assignCategory(dto.gameType, dto.categoryId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return {
      type: 'admin.games.category.assign',
      payload: this.buildCategoriesPayload(),
    };
  }

  async gamesCategoryDelete(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameCategoryDeleteWsDto, payload);
    await this.categories.deleteCategory(dto.id);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return {
      type: 'admin.games.categories',
      payload: this.buildCategoriesPayload(),
    };
  }

  async gamesSetEnabled(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameSetEnabledWsDto, payload);
    await this.overrides.setEnabled(dto.gameType, dto.enabled);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.setEnabled', payload: { ok: true } };
  }

  async gamesUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameUpdateWsDto, payload);
    const update: GameCatalogOverride = {};
    if (typeof dto.enabled === 'boolean') update.enabled = dto.enabled;
    if (typeof dto.minPlayers === 'number') update.minPlayers = dto.minPlayers;
    if (typeof dto.maxPlayers === 'number') update.maxPlayers = dto.maxPlayers;
    if (typeof dto.name === 'string') update.name = dto.name;
    if (typeof dto.description === 'string')
      update.description = dto.description;
    if (typeof dto.rules === 'string') update.rules = dto.rules;
    if (typeof dto.status === 'string') update.status = dto.status;
    if (typeof dto.chatEnabled === 'boolean')
      update.chatEnabled = dto.chatEnabled;
    if (typeof dto.chatSoundsEnabled === 'boolean')
      update.chatSoundsEnabled = dto.chatSoundsEnabled;

    await this.overrides.updateGameOverride(dto.gameType, update);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.update', payload: { ok: true } };
  }

  async gamesReset(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(AdminGameResetWsDto, payload);
    await this.overrides.clearGameOverride(dto.gameType);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.reset', payload: { ok: true } };
  }
}
