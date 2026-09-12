import * as crypto from 'crypto';
import { BotNameRegistryService } from './bot-name-registry.service';
import type { BotNameCacheConfig } from '../../ports/bot-name-cache-config.port';
import type { BusinessClock } from '../../../../../shared/interfaces/public-api';

export class BotNameCacheService {
  private cachedEnabledNames: { values: string[]; expiresAt: number } | null =
    null;
  private readonly namesCacheTtlMs: number;
  private generation = 0;

  constructor(
    private readonly registry: BotNameRegistryService,
    config: BotNameCacheConfig,
    private readonly clock: BusinessClock,
  ) {
    this.namesCacheTtlMs = Number.isSafeInteger(config.namesCacheTtlMs)
      ? Math.min(Math.max(config.namesCacheTtlMs, 0), 86_400_000)
      : 30_000;
  }

  async getEnabledNames(): Promise<string[]> {
    const cached = this.cachedEnabledNames;
    if (
      cached &&
      (this.namesCacheTtlMs === 0 || this.clock.now() < cached.expiresAt)
    ) {
      return this.shuffle(cached.values);
    }

    return this.refreshEnabledNames();
  }

  async refreshEnabledNames(): Promise<string[]> {
    const generation = this.generation;
    const rows = (await this.registry.listEnabledNames())
      .filter((name): name is string => typeof name === 'string')
      .slice(0, 10_000);
    if (generation !== this.generation) return this.shuffle(rows);
    return this.cacheAndShuffle(rows);
  }

  invalidate(): void {
    this.generation++;
    this.cachedEnabledNames = null;
  }

  private cacheAndShuffle(values: string[]): string[] {
    this.cachedEnabledNames = {
      values: [...values],
      expiresAt:
        this.namesCacheTtlMs === 0
          ? Number.MAX_SAFE_INTEGER
          : this.clock.now() + this.namesCacheTtlMs,
    };
    return this.shuffle(values);
  }

  private shuffle(values: string[]): string[] {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
