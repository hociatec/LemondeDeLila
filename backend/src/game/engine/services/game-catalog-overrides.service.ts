import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';
import { GameCatalogOverrideEntity } from '../entities/game-catalog-override.entity';

export type GameCatalogStatus = 'construction' | 'beta' | 'finished';

export type GameCatalogOverride = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
  rules?: string;
  status?: GameCatalogStatus;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
};

type OverridesRoot = {
  games: Record<string, GameCatalogOverride>;
};

@Injectable()
export class GameCatalogOverridesService implements OnModuleInit {
  private readonly logger = new Logger(GameCatalogOverridesService.name);
  private cache: OverridesRoot | null = null;

  private static normalizeStatus(
    value: unknown,
  ): GameCatalogStatus | undefined {
    if (typeof value !== 'string') return undefined;
    const v = value.trim().toLowerCase();
    if (v === 'construction' || v === 'beta' || v === 'finished') {
      return v;
    }
    return undefined;
  }

  constructor(
    @InjectRepository(GameCatalogOverrideEntity)
    private readonly repo: Repository<GameCatalogOverrideEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLoaded();
  }

  getOverrides(): OverridesRoot {
    return this.cache ?? { games: {} };
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
      status: ov.status ?? 'finished',
      minPlayers:
        typeof ov.minPlayers === 'number' ? ov.minPlayers : def.minPlayers,
      maxPlayers:
        typeof ov.maxPlayers === 'number' ? ov.maxPlayers : def.maxPlayers,
      chatEnabled:
        typeof ov.chatEnabled === 'boolean'
          ? ov.chatEnabled
          : typeof def.chatEnabled === 'boolean'
            ? def.chatEnabled
            : true,
      chatSoundsEnabled:
        typeof ov.chatSoundsEnabled === 'boolean'
          ? ov.chatSoundsEnabled
          : typeof def.chatSoundsEnabled === 'boolean'
            ? def.chatSoundsEnabled
            : true,
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
      rules: root.games[gameType].rules ?? null,
      status: root.games[gameType].status ?? null,
      chatEnabled: root.games[gameType].chatEnabled ?? null,
      chatSoundsEnabled: root.games[gameType].chatSoundsEnabled ?? null,
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

    if (typeof next.name === 'string' && !next.name.trim()) delete next.name;
    if (typeof next.description === 'string' && !next.description.trim())
      delete next.description;
    if (typeof next.rules === 'string' && !next.rules.trim()) delete next.rules;
    if (typeof (next as any).status === 'string') {
      const normalized = GameCatalogOverridesService.normalizeStatus(
        (next as any).status,
      );
      if (!normalized) {
        delete (next as any).status;
      } else {
        (next as any).status = normalized;
      }
    }

    root.games[gameType] = next;
    await this.repo.save({
      gameType,
      enabled: typeof next.enabled === 'boolean' ? next.enabled : null,
      minPlayers: typeof next.minPlayers === 'number' ? next.minPlayers : null,
      maxPlayers: typeof next.maxPlayers === 'number' ? next.maxPlayers : null,
      name: typeof next.name === 'string' ? next.name : null,
      description:
        typeof next.description === 'string' ? next.description : null,
      rules: typeof next.rules === 'string' ? next.rules : null,
      status: next.status ?? null,
      chatEnabled:
        typeof next.chatEnabled === 'boolean' ? next.chatEnabled : null,
      chatSoundsEnabled:
        typeof next.chatSoundsEnabled === 'boolean'
          ? next.chatSoundsEnabled
          : null,
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

  private async ensureLoaded(): Promise<void> {
    if (this.cache) return;

    try {
      const rows = await this.repo.find();
      const games: Record<string, GameCatalogOverride> = {};
      for (const row of rows) {
        games[row.gameType] = {
          enabled: typeof row.enabled === 'boolean' ? row.enabled : undefined,
          minPlayers:
            typeof row.minPlayers === 'number' ? row.minPlayers : undefined,
          maxPlayers:
            typeof row.maxPlayers === 'number' ? row.maxPlayers : undefined,
          name: row.name ?? undefined,
          description: row.description ?? undefined,
          rules: row.rules ?? undefined,
          status: GameCatalogOverridesService.normalizeStatus(row.status),
          chatEnabled:
            typeof row.chatEnabled === 'boolean' ? row.chatEnabled : undefined,
          chatSoundsEnabled:
            typeof row.chatSoundsEnabled === 'boolean'
              ? row.chatSoundsEnabled
              : undefined,
        };
      }
      this.cache = { games };
    } catch (error) {
      this.logger.warn(
        `Impossible de charger les overrides catalogue: ${(error as Error).message}`,
      );
      this.cache = { games: {} };
    }
  }
}
