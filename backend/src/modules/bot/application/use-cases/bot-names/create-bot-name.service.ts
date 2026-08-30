import type { BotNameRepository } from '../../ports/bot-name.repository';
import {
  BotNameAlreadyUsedError,
  BotNameRequiredError,
} from '../../errors/bot-application.errors';
import type { BotNameRecord } from '../../contracts/bot-name.record';
import { BotNameCacheService } from './bot-name-cache.service';
import { BotNameNormalizerService } from './bot-name-normalizer.service';

export class CreateBotNameService {
  constructor(
    private readonly botNames: BotNameRepository,
    private readonly cache: BotNameCacheService,
    private readonly normalizer: BotNameNormalizerService,
  ) {}

  async execute(name: string, enabled = true): Promise<BotNameRecord> {
    const sanitized = this.normalizer.sanitize(name);
    if (!sanitized) {
      throw new BotNameRequiredError();
    }
    const exists = await this.botNames.findByName(sanitized);
    if (exists) {
      throw new BotNameAlreadyUsedError();
    }
    const saved = await this.botNames.create({ name: sanitized, enabled });
    this.cache.invalidate();
    return saved;
  }
}
