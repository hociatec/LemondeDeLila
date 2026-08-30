import { Inject, Injectable } from '@nestjs/common';

import { CatalogGame } from '../contracts/catalog-game.record';
import {
  CATALOG_CACHE_CONFIG,
  type CatalogCacheConfig,
} from '../ports/catalog-cache-config.port';

@Injectable()
export class CatalogCacheService {
  private games: CatalogGame[] | null = null;
  private expiresAtMs = 0;
  private readonly ttlMs: number;

  constructor(
    @Inject(CATALOG_CACHE_CONFIG)
    config: CatalogCacheConfig,
  ) {
    this.ttlMs = config.ttlMs;
  }

  getGames(): CatalogGame[] | null {
    if (!this.games) {
      return null;
    }
    if (this.ttlMs !== 0 && Date.now() >= this.expiresAtMs) {
      this.clear();
      return null;
    }
    return this.games;
  }

  setGames(games: CatalogGame[]): CatalogGame[] {
    this.games = games;
    this.expiresAtMs =
      this.ttlMs === 0 ? Number.MAX_SAFE_INTEGER : Date.now() + this.ttlMs;
    return games;
  }

  clear(): void {
    this.games = null;
    this.expiresAtMs = 0;
  }
}
