import { Injectable } from '@nestjs/common';
import { requireAdmin } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { GameCategoriesService } from '../../game/engine/services/game-categories.service';
import { GameCatalogOverridesService } from '../../game/engine/services/game-catalog-overrides.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { AdminCatalogInvalidationService } from '../services/admin-catalog-invalidation.service';
import {
  AdminGameCategoryAssignWsDto,
  AdminGameCategoryCreateWsDto,
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
          chatEnabled,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { type: 'admin.games.list', payload: { games: payload } };
  }

  async gamesCategoriesList(session: WsSession, payload: any) {
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

  async gamesSetEnabled(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminGameSetEnabledWsDto,
      payload,
    ) as AdminGameSetEnabledWsDto;
    await this.overrides.setEnabled(dto.gameType, dto.enabled);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.setEnabled', payload: { ok: true } };
  }

  async gamesUpdate(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminGameUpdateWsDto,
      payload,
    ) as AdminGameUpdateWsDto;
    await this.overrides.updateGameOverride(dto.gameType, {
      enabled: dto.enabled,
      minPlayers: dto.minPlayers,
      maxPlayers: dto.maxPlayers,
      name: dto.name,
      description: dto.description,
      chatEnabled: dto.chatEnabled,
    });
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.update', payload: { ok: true } };
  }

  async gamesReset(session: WsSession, payload: any) {
    const admin = requireAdmin(session);
    const dto = this.validator.validate(
      AdminGameResetWsDto,
      payload,
    ) as AdminGameResetWsDto;
    await this.overrides.clearGameOverride(dto.gameType);
    await this.catalogInvalidation.invalidateCatalogAndNotify(admin.id);
    return { type: 'admin.games.reset', payload: { ok: true } };
  }
}
