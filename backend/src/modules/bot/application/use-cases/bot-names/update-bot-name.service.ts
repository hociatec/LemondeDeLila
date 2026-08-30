import type { BotNameRepository } from '../../ports/bot-name.repository';
import {
  BotNameAlreadyUsedError,
  BotNameRequiredError,
  BotNotFoundError,
} from '../../errors/bot-application.errors';
import type { BotNameRecord } from '../../contracts/bot-name.record';
import { BotNameCacheService } from './bot-name-cache.service';
import { BotNameNormalizerService } from './bot-name-normalizer.service';

export class UpdateBotNameService {
  constructor(
    private readonly botNames: BotNameRepository,
    private readonly cache: BotNameCacheService,
    private readonly normalizer: BotNameNormalizerService,
  ) {}

  async execute(
    id: number,
    update: { name?: string | null; enabled?: boolean | null },
  ): Promise<BotNameRecord> {
    const botName = await this.botNames.findById(id);
    if (!botName) {
      throw new BotNotFoundError();
    }

    if (update.name != null) {
      const sanitized = this.normalizer.sanitize(update.name);
      if (!sanitized) {
        throw new BotNameRequiredError();
      }
      if (sanitized !== botName.name) {
        const exists = await this.botNames.findByName(sanitized);
        if (exists) {
          throw new BotNameAlreadyUsedError();
        }
        botName.name = sanitized;
      }
    }

    if (update.enabled != null) {
      botName.enabled = Boolean(update.enabled);
    }

    const saved = await this.botNames.save(botName);
    this.cache.invalidate();
    return saved;
  }
}
