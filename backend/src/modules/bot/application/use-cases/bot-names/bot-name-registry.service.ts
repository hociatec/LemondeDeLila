import type { BotNameRepository } from '../../ports/bot-name.repository';

export class BotNameRegistryService {
  private static readonly MAX_NAMES = 10_000;
  constructor(private readonly botNames: BotNameRepository) {}

  async listEnabledNames(): Promise<string[]> {
    const rows = await this.botNames.listEnabled();
    if (rows.length === 0) {
      await this.seedDefaultNames();
      return (await this.botNames.listEnabled())
        .slice(0, BotNameRegistryService.MAX_NAMES)
        .map((row) => row.name);
    }
    return rows.slice(0, BotNameRegistryService.MAX_NAMES).map((row) => row.name);
  }

  private async seedDefaultNames(): Promise<void> {
    const defaults = ['Lila', 'Cosmo', 'Nova', 'Pixel', 'Orion', 'Echo', 'Bot'];
    if ((await this.botNames.count()) > 0) {
      return;
    }
    for (const name of defaults) {
      await this.botNames.create({ name, enabled: true });
    }
  }
}
