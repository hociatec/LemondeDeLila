import { Injectable } from '@nestjs/common';
import {
  CreateBotNameService,
  DeleteBotNameService,
  ListBotNamesService,
  UpdateBotNameService,
} from '../../modules/bot/public-api';
import { BotSettingsService } from '../../game/public-api';
import type {
  AdminBotName,
  AdminBotPort,
  AdminBotSettings,
} from '../../modules/admin/public-api';

@Injectable()
export class AppAdminBotAdapter implements AdminBotPort {
  constructor(
    private readonly list: ListBotNamesService,
    private readonly create: CreateBotNameService,
    private readonly update: UpdateBotNameService,
    private readonly remove: DeleteBotNameService,
    private readonly settings: BotSettingsService,
  ) {}

  async listNames(): Promise<AdminBotName[]> {
    return (await this.list.execute()).map((item) => ({
      id: item.id,
      name: item.name,
      enabled: item.enabled,
      createdAt: item.createdAt,
    }));
  }

  async createName(name: string, enabled: boolean): Promise<void> {
    await this.create.execute(name, enabled);
  }

  async updateName(
    id: number,
    update: { name?: string; enabled?: boolean },
  ): Promise<void> {
    await this.update.execute(id, update);
  }

  async deleteName(id: number): Promise<void> {
    await this.remove.execute(id);
  }

  getSettings(): AdminBotSettings {
    return this.settings.getSettings();
  }

  updateSettings(update: Partial<AdminBotSettings>): Promise<AdminBotSettings> {
    return this.settings.updateSettings(update);
  }
}

