import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BotSettingsRecord,
  BotSettingsRepository,
} from '../../../../application/contracts/bot-settings.repository';
import { BotSettingsEntity } from '../entities/bot-settings.entity';

export class BotSettingsTypeormRepository implements BotSettingsRepository {
  constructor(
    @InjectRepository(BotSettingsEntity)
    private readonly repo: Repository<BotSettingsEntity>,
  ) {}

  async findSettings(): Promise<BotSettingsRecord | null> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (!existing) {
      return null;
    }

    return {
      botTurnDelayMs: existing.botTurnDelayMs,
      botStartDelayMs: existing.botStartDelayMs,
      botDrawDelayMs: existing.botDrawDelayMs,
    };
  }

  async saveSettings(settings: BotSettingsRecord): Promise<void> {
    await this.repo.save({
      id: 1,
      botTurnDelayMs: settings.botTurnDelayMs,
      botStartDelayMs: settings.botStartDelayMs,
      botDrawDelayMs: settings.botDrawDelayMs,
    });
  }
}
