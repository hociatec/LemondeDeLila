import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  GameCatalogDefinition,
  GameRuntime,
  GameRuntimeDescriptor,
} from '../ports/game-runtime.port';
import {
  GAME_CATALOG_READER,
  type GameCatalogReader,
} from '../ports/game-catalog.reader';
import type { GameCatalogEntryRecord } from '../models/game-catalog-entry.model';
import { GameCatalogOverridesService } from '../../../engine/application/services/game-catalog-overrides.service';
import { assertGameManifestMatches } from '../helpers/game-manifest-validation';

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
    const previous = this.handlers.get(handler.gameType);
    if (previous && previous !== handler) {
      throw new Error(`Runtime de jeu dupliqué: ${handler.gameType}`);
    }
    const manifest = this.getManifestCache().get(handler.gameType)?.manifest;
    if (manifest) this.assertManifest(handler, manifest);
    this.handlers.set(handler.gameType, handler);
  }

  getHandler(gameType: string): GameRuntime | undefined {
    return this.handlers.get(gameType);
  }

  describe(gameType: string): GameRuntimeDescriptor | null {
    return this.handlers.get(gameType)?.getDescriptor() ?? null;
  }

  listDescriptors(): GameRuntimeDescriptor[] {
    return [...this.handlers.values()]
      .map((handler) => handler.getDescriptor())
      .sort(
        (left, right) =>
          left.name.localeCompare(right.name, 'fr') ||
          left.id.localeCompare(right.id, 'en'),
      );
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
      if (manifest) this.assertManifest(handler, manifest);
      const override = this.overrides?.getGameOverride(handler.gameType);
      const minPlayers = Math.min(
        handler.maxPlayers,
        Math.max(
          handler.minPlayers,
          toPlayerCount(override?.minPlayers) ?? handler.minPlayers,
        ),
      );
      const maxPlayers = Math.max(
        minPlayers,
        Math.min(
          handler.maxPlayers,
          toPlayerCount(override?.maxPlayers) ?? handler.maxPlayers,
        ),
      );

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
        minPlayers,
        maxPlayers,
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
        status: override?.status,
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
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id, 'en'),
      );
  }

  private assertManifest(handler: GameRuntime, manifest: unknown): void {
    assertGameManifestMatches(manifest, {
      code: handler.gameType,
      name: handler.displayName,
      minPlayers: handler.minPlayers,
      maxPlayers: handler.maxPlayers,
      summary: handler.description,
    });
  }

  private getManifestCache(): Map<string, GameCatalogEntryRecord> {
    if (this.manifestCache) {
      return this.manifestCache;
    }

    const manifests = new Map<string, GameCatalogEntryRecord>();
    for (const entry of this.catalogReader.listEntries()) {
      const code = String(entry.manifest.code ?? '').trim();
      if (code) {
        if (manifests.has(code)) {
          throw new Error(`Manifeste de jeu dupliqué: ${code}`);
        }
        manifests.set(code, entry);
      }
    }

    this.manifestCache = manifests;
    return manifests;
  }
}

function toPlayerCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
    ? value
    : undefined;
}
