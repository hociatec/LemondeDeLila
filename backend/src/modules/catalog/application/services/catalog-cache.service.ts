import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';

import { CatalogGame } from '../read-models/catalog-game.record';
import {
  CATALOG_CACHE_CONFIG,
  type CatalogCacheConfig,
} from '../ports/catalog-cache-config.port';

@Injectable()
/**
 * This process-local cache is explicitly best effort. It is never a source of
 * truth and revisions are local to one instance; cross-instance freshness is
 * provided by the catalog read path rather than by this cache.
 */
export class CatalogCacheService {
  private games: CatalogGame[] | null = null;
  private expiresAtMs = 0;
  private readonly ttlMs: number;
  private generation = 0;

  constructor(
    @Inject(CATALOG_CACHE_CONFIG)
    config: CatalogCacheConfig,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {
    this.ttlMs = config.ttlMs;
  }

  getGames(): CatalogGame[] | null {
    if (!this.games) {
      return null;
    }
    if (this.ttlMs !== 0 && this.clock.now() >= this.expiresAtMs) {
      this.clear();
      return null;
    }
    return this.copy(this.games);
  }

  revision(): number {
    return this.generation;
  }

  setGames(games: CatalogGame[], revision = this.generation): CatalogGame[] {
    if (revision !== this.generation) return this.copy(games);
    this.games = this.copy(games);
    this.expiresAtMs =
      this.ttlMs === 0
        ? Number.MAX_SAFE_INTEGER
        : this.clock.now() + this.ttlMs;
    return this.copy(games);
  }

  clear(): void {
    this.generation++;
    this.games = null;
    this.expiresAtMs = 0;
  }

  private copy(games: CatalogGame[]): CatalogGame[] {
    return games.map((game) => ({ ...game, categories: [...game.categories] }));
  }
}
