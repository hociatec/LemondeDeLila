import { BotNameRegistryService } from './bot-name-registry.service';

export class BotNameCacheService {
  private cachedEnabledNames: { values: string[]; expiresAt: number } | null =
    null;
  private readonly namesCacheTtlMs: number;

  constructor(private readonly registry: BotNameRegistryService) {
    const ttlCandidate = Number(process.env.BOT_NAMES_CACHE_TTL_MS ?? 30000);
    this.namesCacheTtlMs =
      Number.isFinite(ttlCandidate) && ttlCandidate >= 0 ? ttlCandidate : 30000;
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
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
