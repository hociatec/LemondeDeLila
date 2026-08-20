import { Injectable } from '@nestjs/common';
import { CreateBotNameService } from '../../../../bot/application/use-cases/bot-names/create-bot-name.service';
import { DeleteBotNameService } from '../../../../bot/application/use-cases/bot-names/delete-bot-name.service';
import { ListBotNamesService } from '../../../../bot/application/use-cases/bot-names/list-bot-names.service';
import { UpdateBotNameService } from '../../../../bot/application/use-cases/bot-names/update-bot-name.service';
import { mapBotApplicationError } from '../../../../bot/infrastructure/errors/bot-error-http.mapper';
import { BotSettingsService } from '../../../../game/modules/bot/services/bot-settings.service';

@Injectable()
export class AdminBotsService {
  constructor(
    private readonly listBotNamesUseCase: ListBotNamesService,
    private readonly createBotNameUseCase: CreateBotNameService,
    private readonly updateBotNameUseCase: UpdateBotNameService,
    private readonly deleteBotNameUseCase: DeleteBotNameService,
    private readonly botSettings: BotSettingsService,
  ) {}

  async listNames() {
    const names = await this.listBotNamesUseCase.execute();
    return {
      names: names.map((name) => ({
        id: name.id,
        name: name.name,
        enabled: name.enabled,
        createdAt: name.createdAt,
      })),
    };
  }

  getSettings() {
    return this.botSettings.getSettings();
  }

  async updateSettings(update: {
    botTurnDelayMs?: number;
    botStartDelayMs?: number;
    botDrawDelayMs?: number;
  }) {
    return this.botSettings.updateSettings(update);
  }

  async createName(name: string, enabled = true) {
    try {
      await this.createBotNameUseCase.execute(name, enabled);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }

  async updateName(
    id: number,
    update: { name?: string; enabled?: boolean },
  ) {
    try {
      await this.updateBotNameUseCase.execute(id, update);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }

  async deleteName(id: number) {
    try {
      await this.deleteBotNameUseCase.execute(id);
    } catch (error) {
      throw mapBotApplicationError(error);
    }
    return this.listNames();
  }
}
