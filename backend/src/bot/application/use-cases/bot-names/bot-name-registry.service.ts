import type { BotNameRepository } from '../../ports/bot-name.repository';

export class BotNameRegistryService {
  constructor(private readonly botNames: BotNameRepository) {}

  async listEnabledNames(): Promise<string[]> {
    const rows = await this.botNames.listEnabled();
    if (rows.length === 0) {
      await this.seedDefaultNames();
      return (await this.botNames.listEnabled()).map((row) => row.name);
    }
    return rows.map((row) => row.name);
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
