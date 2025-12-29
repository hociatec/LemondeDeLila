import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';
import { GameCatalogOverrideEntity } from '../entities/game-catalog-override.entity';

export type GameCatalogOverride = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
};

type OverridesFile = {
  games: Record<string, GameCatalogOverride>;
};

@Injectable()
export class GameCatalogOverridesService implements OnModuleInit {
  private readonly logger = new Logger(GameCatalogOverridesService.name);
  private readonly filePath: string;
  private cache: OverridesFile | null = null;

  constructor(
    @InjectRepository(GameCatalogOverrideEntity)
    private readonly repo: Repository<GameCatalogOverrideEntity>,
  ) {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'game-overrides.json');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  getOverrides(): OverridesFile {
    if (this.cache) return this.cache;
    return { games: {} };
  }

  getGameOverride(gameType: string): GameCatalogOverride | null {
    if (!gameType) return null;
    const root = this.getOverrides();
    return root.games[gameType] ?? null;
  }

  apply(def: GameDefinition): GameDefinition & { enabled?: boolean } {
    const ov = this.getGameOverride(def.id);
    if (!ov) return { ...def, enabled: true };
    return {
      ...(def as any),
      enabled: ov.enabled !== false,
      name: ov.name ?? def.name,
      description: ov.description ?? def.description,
      minPlayers: typeof ov.minPlayers === 'number' ? ov.minPlayers : def.minPlayers,
      maxPlayers: typeof ov.maxPlayers === 'number' ? ov.maxPlayers : def.maxPlayers,
    };
  }

  async setEnabled(gameType: string, enabled: boolean): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    await this.ensureLoaded();
    const root = this.getOverrides();
    root.games[gameType] = { ...(root.games[gameType] ?? {}), enabled };
    await this.repo.save({
      gameType,
      enabled,
      minPlayers: root.games[gameType].minPlayers ?? null,
      maxPlayers: root.games[gameType].maxPlayers ?? null,
      name: root.games[gameType].name ?? null,
      description: root.games[gameType].description ?? null,
    });
    this.cache = root;
  }

  async updateGameOverride(
    gameType: string,
    update: GameCatalogOverride,
  ): Promise<GameCatalogOverride> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    await this.ensureLoaded();
    const root = this.getOverrides();
    const next: GameCatalogOverride = {
      ...(root.games[gameType] ?? {}),
      ...update,
    };
    // Nettoyage: chaînes vides => suppression du champ
    if (typeof next.name === 'string' && !next.name.trim()) delete next.name;
    if (typeof next.description === 'string' && !next.description.trim())
      delete next.description;
    root.games[gameType] = next;
    await this.repo.save({
      gameType,
      enabled: typeof next.enabled === 'boolean' ? next.enabled : null,
      minPlayers: typeof next.minPlayers === 'number' ? next.minPlayers : null,
      maxPlayers: typeof next.maxPlayers === 'number' ? next.maxPlayers : null,
      name: typeof next.name === 'string' ? next.name : null,
      description: typeof next.description === 'string' ? next.description : null,
    });
    this.cache = root;
    return next;
  }

  async clearGameOverride(gameType: string): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    await this.ensureLoaded();
    const root = this.getOverrides();
    delete root.games[gameType];
    await this.repo.delete({ gameType });
    this.cache = root;
  }

  private tryLoadFromJson(): OverridesFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { games: {} };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as OverridesFile;
      if (!parsed || typeof parsed !== 'object') return { games: {} };
      if (!parsed.games || typeof parsed.games !== 'object') return { games: {} };
      return { games: parsed.games };
    } catch (err) {
      this.logger.warn(
        `Impossible de charger les overrides catalogue (${this.filePath}): ${
          (err as Error).message
        }`,
      );
      return { games: {} };
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cache) return;

    const rows = await this.repo.find();
    if (rows.length === 0) {
      const imported = this.tryLoadFromJson();
      this.cache = { games: imported.games ?? {} };
      for (const [gameType, ov] of Object.entries(this.cache.games)) {
        await this.repo.save({
          gameType,
          enabled: typeof ov.enabled === 'boolean' ? ov.enabled : null,
          minPlayers: typeof ov.minPlayers === 'number' ? ov.minPlayers : null,
          maxPlayers: typeof ov.maxPlayers === 'number' ? ov.maxPlayers : null,
          name: typeof ov.name === 'string' ? ov.name : null,
          description: typeof ov.description === 'string' ? ov.description : null,
        });
      }
      return;
    }

    const games: Record<string, GameCatalogOverride> = {};
    for (const row of rows) {
      games[row.gameType] = {
        enabled: typeof row.enabled === 'boolean' ? row.enabled : undefined,
        minPlayers: typeof row.minPlayers === 'number' ? row.minPlayers : undefined,
        maxPlayers: typeof row.maxPlayers === 'number' ? row.maxPlayers : undefined,
        name: row.name ?? undefined,
        description: row.description ?? undefined,
      };
    }
    this.cache = { games };
  }
}
