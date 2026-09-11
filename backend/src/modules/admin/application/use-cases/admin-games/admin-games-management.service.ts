import { BadRequestException, Injectable } from '@nestjs/common';
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
    assertAdminId(adminId);
    await this.categories.create(input.name, input.parentId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async updateCategory(
    adminId: number,
    input: { id: string; name?: string; parentId?: string | null },
  ) {
    assertAdminId(adminId);
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
    assertAdminId(adminId);
    await this.categories.assign(input.gameType, input.categoryId ?? null);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async deleteCategory(adminId: number, id: string) {
    assertAdminId(adminId);
    await this.categories.delete(id);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return this.presenter.buildCategoriesPayload();
  }

  async setEnabled(
    adminId: number,
    input: { gameType: string; enabled: boolean },
  ) {
    assertAdminId(adminId);
    await this.overrides.setEnabled(input.gameType, input.enabled);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }

  async updateGame(adminId: number, command: UpdateAdminGameCommand) {
    assertAdminId(adminId);
    await this.overrides.update(command);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }

  async resetGame(adminId: number, gameType: string) {
    assertAdminId(adminId);
    await this.overrides.reset(gameType);
    await this.catalogInvalidation.invalidateCatalogAndNotify(adminId);
    return { ok: true };
  }
}

function assertAdminId(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException('Identifiant administrateur invalide');
  }
}
