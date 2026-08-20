import { Inject, Injectable } from '@nestjs/common';
import {
  ADMIN_GAME_CATEGORIES_PORT,
  type AdminGameCategoriesPort,
} from '../../ports/admin-game-categories.port';
import {
  ADMIN_GAME_OVERRIDES_PORT,
  type AdminGameOverridesPort,
} from '../../ports/admin-game-overrides.port';
import {
  ADMIN_GAME_REGISTRY_PORT,
  type AdminGameRegistryPort,
} from '../../ports/admin-game-registry.port';

@Injectable()
export class AdminGamesPresenterService {
  constructor(
    @Inject(ADMIN_GAME_REGISTRY_PORT)
    private readonly registry: AdminGameRegistryPort,
    @Inject(ADMIN_GAME_OVERRIDES_PORT)
    private readonly overrides: AdminGameOverridesPort,
    @Inject(ADMIN_GAME_CATEGORIES_PORT)
    private readonly categories: AdminGameCategoriesPort,
  ) {}

  async buildGamesPayload() {
    const games = await this.registry.listGames({
      includeDisabledOverrides: true,
    });

    const payload = games
      .map((game) => {
        const override = this.overrides.getGameOverride(game.id);
        const enabled = override?.enabled !== false;
        const chatEnabled =
          typeof override?.chatEnabled === 'boolean'
            ? override.chatEnabled
            : typeof game.chatEnabled === 'boolean'
              ? game.chatEnabled
              : true;
        const chatSoundsEnabled =
          typeof override?.chatSoundsEnabled === 'boolean'
            ? override.chatSoundsEnabled
            : typeof game.chatSoundsEnabled === 'boolean'
              ? game.chatSoundsEnabled
              : true;
        const status = override?.status ?? 'finished';
        const categoryId = this.categories.getAssignment(game.id);

        return {
          id: game.id,
          name: game.name,
          category: game.category,
          categoryId: categoryId ?? undefined,
          subcategory: game.subcategory,
          description: game.description,
          rules: override?.rules ?? undefined,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          enabled,
          status,
          chatEnabled,
          chatSoundsEnabled,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    return { games: payload };
  }

  buildCategoriesPayload() {
    return {
      categories: this.categories.getCategories(),
      assignments: this.categories.listAssignments(),
    };
  }
}
