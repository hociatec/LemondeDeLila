import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BotApplicationError,
  CreateBotNameService,
  DeleteBotNameService,
  ListBotNamesService,
  UpdateBotNameService,
} from '../../../../bot/public-api';
import { BotSettingsService } from '../../../../game/public-api';

function mapBotApplicationError(error: unknown): unknown {
  if (!(error instanceof BotApplicationError)) {
    return error;
  }

  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(error.message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}

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

  async updateName(id: number, update: { name?: string; enabled?: boolean }) {
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
