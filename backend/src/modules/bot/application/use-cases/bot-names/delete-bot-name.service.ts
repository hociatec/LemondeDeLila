import type { BotNameRepository } from '../../ports/bot-name.repository';
import { BotNotFoundError } from '../../errors/bot-application.errors';
import type { BotNameRecord } from '../../models/bot-name.record';
import { BotNameCacheService } from './bot-name-cache.service';

export class DeleteBotNameService {
  constructor(
    private readonly botNames: BotNameRepository,
    private readonly cache: BotNameCacheService,
  ) {}

  async execute(id: number): Promise<BotNameRecord> {
    const botName = await this.botNames.findById(id);
    if (!botName) {
      throw new BotNotFoundError();
    }
    await this.botNames.delete(id);
    this.cache.invalidate();
    return botName;
  }
}
