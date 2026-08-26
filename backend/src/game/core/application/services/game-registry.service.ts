import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GameCatalogDefinition,
  GameRuntime,
} from '../contracts/game-runtime.interface';
import {
  GAME_CATALOG_READER,
  type GameCatalogReader,
} from '../ports/game-catalog.reader';
import type { GameCatalogEntryRecord } from '../models/game-catalog-entry.model';
import { GameCatalogOverridesService } from '../../../engine/application/services/game-catalog-overrides.service';

type ListGamesOptions = {
  includeDisabledOverrides?: boolean;
};

@Injectable()
export class GameRegistryService {
  private readonly handlers = new Map<string, GameRuntime>();
  private manifestCache: Map<string, GameCatalogEntryRecord> | null = null;

  constructor(
    @Inject(GAME_CATALOG_READER)
    private readonly catalogReader: GameCatalogReader,
    @Optional()
    private readonly overrides?: GameCatalogOverridesService,
  ) {}

  register(handler: GameRuntime): void {
    this.handlers.set(handler.gameType, handler);
  }

  getHandler(gameType: string): GameRuntime | undefined {
    return this.handlers.get(gameType);
  }

  invalidateCache(): void {
    this.manifestCache = null;
  }

  async listGames(
    options: ListGamesOptions = {},
  ): Promise<GameCatalogDefinition[]> {
    const manifests = this.getManifestCache();
    const defs = Array.from(this.handlers.values()).map((handler) => {
      const entry = manifests.get(handler.gameType);
      const manifest = entry?.manifest;
      const override = this.overrides?.getGameOverride(handler.gameType);

      const base: GameCatalogDefinition = {
        id: handler.gameType,
        name:
          String(
            override?.name ?? manifest?.name ?? handler.displayName ?? '',
          ).trim() || handler.gameType,
        category: handler.category,
        subcategory: handler.subcategory,
        description:
          String(
            override?.description ??
              manifest?.summary ??
              handler.description ??
              '',
          ).trim() || undefined,
        minPlayers:
          toFiniteNumber(override?.minPlayers) ??
          toFiniteNumber(manifest?.minPlayers) ??
          toFiniteNumber(handler.minPlayers) ??
          2,
        maxPlayers:
          toFiniteNumber(override?.maxPlayers) ??
          toFiniteNumber(manifest?.maxPlayers) ??
          toFiniteNumber(handler.maxPlayers) ??
          4,
        chatEnabled:
          typeof override?.chatEnabled === 'boolean'
            ? override.chatEnabled
            : typeof manifest?.chatEnabled === 'boolean'
              ? manifest.chatEnabled
              : true,
        chatSoundsEnabled:
          typeof override?.chatSoundsEnabled === 'boolean'
            ? override.chatSoundsEnabled
            : typeof manifest?.chatSoundsEnabled === 'boolean'
              ? manifest.chatSoundsEnabled
              : true,
        status: override?.status as GameCatalogDefinition['status'] | undefined,
        manifestPath: entry?.manifestPath,
        rulesPath: entry?.rulesPath,
      };

      if (!base.status && manifest?.status) {
        base.status = manifest.status;
      }

      return base;
    });

    return defs
      .filter(
        (def) =>
          options.includeDisabledOverrides === true ||
          this.overrides?.getGameOverride(def.id)?.enabled !== false,
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  private getManifestCache(): Map<string, GameCatalogEntryRecord> {
    if (this.manifestCache) {
      return this.manifestCache;
    }

    const manifests = new Map<string, GameCatalogEntryRecord>();
    for (const entry of this.catalogReader.listEntries()) {
      const code = String(entry.manifest.code ?? '').trim();
      if (code) {
        manifests.set(code, entry);
      }
    }

    this.manifestCache = manifests;
    return manifests;
  }
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
