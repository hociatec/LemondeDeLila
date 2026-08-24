import * as crypto from 'crypto';
import { BotNameRegistryService } from './bot-name-registry.service';
import type { BotNameCacheConfig } from '../../../application/ports/bot-name-cache-config.port';

export class BotNameCacheService {
  private cachedEnabledNames: { values: string[]; expiresAt: number } | null =
    null;
  private readonly namesCacheTtlMs: number;

  constructor(
    private readonly registry: BotNameRegistryService,
    config: BotNameCacheConfig,
  ) {
    this.namesCacheTtlMs = config.namesCacheTtlMs;
  }

  async getEnabledNames(): Promise<string[]> {
    const cached = this.cachedEnabledNames;
    if (
      cached &&
      (this.namesCacheTtlMs === 0 || Date.now() < cached.expiresAt)
    ) {
      return this.shuffle(cached.values);
    }

    const rows = await this.registry.listEnabledNames();
    return this.cacheAndShuffle(rows);
  }

  invalidate(): void {
    this.cachedEnabledNames = null;
  }

  private cacheAndShuffle(values: string[]): string[] {
    this.cachedEnabledNames = {
      values,
      expiresAt:
        this.namesCacheTtlMs === 0
          ? Number.MAX_SAFE_INTEGER
          : Date.now() + this.namesCacheTtlMs,
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
