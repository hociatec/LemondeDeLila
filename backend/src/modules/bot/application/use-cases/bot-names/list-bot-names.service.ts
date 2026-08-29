import type { BotNameRepository } from '../../ports/bot-name.repository';
import type { BotNameRecord } from '../../models/bot-name.record';

export class ListBotNamesService {
  constructor(private readonly botNames: BotNameRepository) {}

  execute(): Promise<BotNameRecord[]> {
    return this.botNames.listAll();
  }
}
