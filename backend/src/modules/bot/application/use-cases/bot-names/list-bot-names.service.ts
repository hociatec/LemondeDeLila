import type { BotNameRepository } from '../../ports/bot-name.repository';
import type { BotNameRecord } from '../../read-models/bot-name.record';

export class ListBotNamesService {
  private static readonly MAX_NAMES = 10_000;
  constructor(private readonly botNames: BotNameRepository) {}

  execute(): Promise<BotNameRecord[]> {
    return this.botNames
      .listAll()
      .then((names) => names.slice(0, ListBotNamesService.MAX_NAMES));
  }
}
