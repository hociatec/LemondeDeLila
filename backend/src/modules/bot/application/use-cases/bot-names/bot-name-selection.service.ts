import type { BotRoomRecord } from '../../models/bot-room.record';
import { BotUnavailableNamesError } from '../../errors/bot-application.errors';
import { BotNameCacheService } from './bot-name-cache.service';
import { BotNameNormalizerService } from './bot-name-normalizer.service';

export class BotNameSelectionService {
  constructor(
    private readonly cache: BotNameCacheService,
    private readonly normalizer: BotNameNormalizerService,
  ) {}

  async pickName(existing: BotRoomRecord[]): Promise<string> {
    const names = existing.map((bot) => bot.name.toLowerCase());
    const exclude = new Set(names);
    const candidates = await this.cache.getEnabledNames();
    for (const candidate of candidates) {
      const sanitized = this.normalizer.sanitize(candidate);
      if (!exclude.has(sanitized.toLowerCase())) {
        return sanitized;
      }
    }
    throw new BotUnavailableNamesError();
  }
}
