import type { BotRoomRecord } from '../../read-models/bot-room.record';
import { BotUnavailableNamesError } from '../../errors/bot-application.errors';
import { BotNameCacheService } from './bot-name-cache.service';
import { BotNameNormalizerService } from './bot-name-normalizer.service';

export class BotNameSelectionService {
  constructor(
    private readonly cache: BotNameCacheService,
    private readonly normalizer: BotNameNormalizerService,
  ) {}

  async pickName(existing: BotRoomRecord[]): Promise<string> {
    const names = existing.slice(0, 64).map((bot) =>
      String(bot.name ?? '')
        .slice(0, 150)
        .toLowerCase(),
    );
    const exclude = new Set(names);
    const candidates = await this.cache.refreshEnabledNames();
    for (const candidate of candidates.slice(0, 10_000)) {
      const sanitized = this.normalizer.sanitize(candidate);
      if (!exclude.has(sanitized.toLowerCase())) {
        return sanitized;
      }
    }
    throw new BotUnavailableNamesError();
  }
}
