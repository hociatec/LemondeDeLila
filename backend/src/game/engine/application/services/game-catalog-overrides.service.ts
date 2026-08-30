import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { GameCatalogOverrideRecord } from '../contracts/game-catalog-override.model';
import {
  GAME_CATALOG_OVERRIDES_REPOSITORY,
  type GameCatalogOverridesRepository,
} from '../ports/game-catalog-overrides.repository';

@Injectable()
export class GameCatalogOverridesService {
  private cache: Map<string, GameCatalogOverrideRecord> | null = null;

  constructor(
    @Inject(GAME_CATALOG_OVERRIDES_REPOSITORY)
    private readonly overrides: GameCatalogOverridesRepository,
  ) {}

  getGameOverride(gameType: string): GameCatalogOverrideRecord | undefined {
    const map = this.cache;
    return map?.get(gameType);
  }

  async setEnabled(gameType: string, enabled: boolean): Promise<void> {
    await this.updateGameOverride(gameType, { enabled });
  }

  async updateGameOverride(
    gameType: string,
    update: GameCatalogOverrideRecord,
  ): Promise<void> {
    await this.overrides.save(gameType, update);
    await this.reload();
  }

  async clearGameOverride(gameType: string): Promise<void> {
    await this.overrides.delete(gameType);
    await this.reload();
  }

  async reload(): Promise<void> {
    const rows = await this.overrides.findAll();
    this.cache = new Map(rows.map((row) => [row.gameType, row.override]));
  }
}
