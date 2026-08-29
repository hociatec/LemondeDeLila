import { Injectable } from '@nestjs/common';
import { AdminCatalogInvalidationService } from '../../services/admin-catalog-invalidation.service';
import type { UpdateAdminGameCommand } from './admin-games.types';
import { AdminGameCategoriesService } from './admin-game-categories.service';
import { AdminGameOverridesService } from './admin-game-overrides.service';
import { AdminGamesPresenterService } from './admin-games-presenter.service';

@Injectable()
export class AdminGamesManagementService {
  constructor(
    private readonly presenter: AdminGamesPresenterService,
    private readonly categories: AdminGameCategoriesService,
    private readonly overrides: AdminGameOverridesService,
    private readonly catalogInvalidation: AdminCatalogInvalidationService,
  ) {}

  listGames() {
    return this.presenter.buildGamesPayload();
  }

  listCategories() {
    return this.presenter.buildCategoriesPayload();
  }

  async createCategory(
    adminId: number,
    input: { name: string; parentId?: string | null },
  ) {
    await this.categories.create(input.name, input.parentId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async updateCategory(
    adminId: number,
    input: { id: string; name?: string; parentId?: string | null },
  ) {
    await this.categories.update(input.id, {
      name: input.name,
      parentId: input.parentId ?? null,
    });
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async assignCategory(
    adminId: number,
    input: { gameType: string; categoryId?: string | null },
  ) {
    await this.categories.assign(input.gameType, input.categoryId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async deleteCategory(adminId: number, id: string) {
    await this.categories.delete(id);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async setEnabled(
    adminId: number,
    input: { gameType: string; enabled: boolean },
  ) {
    await this.overrides.setEnabled(input.gameType, input.enabled);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }

  async updateGame(adminId: number, command: UpdateAdminGameCommand) {
    await this.overrides.update(command);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }

  async resetGame(adminId: number, gameType: string) {
    await this.overrides.reset(gameType);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }
}
