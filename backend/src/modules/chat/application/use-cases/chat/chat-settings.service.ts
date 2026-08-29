import { Injectable } from '@nestjs/common';

import { ChatSettings } from '../../models/chat-settings.record';
import { GetChatSettingsService } from './get-chat-settings.service';
import { UpdateChatSettingsService } from './update-chat-settings.service';

@Injectable()
export class ChatSettingsService {
  constructor(
    private readonly getSettingsService: GetChatSettingsService,
    private readonly updateSettingsService: UpdateChatSettingsService,
  ) {}

  getSettings(): ChatSettings {
    return this.getSettingsService.getCached();
  }

  getChatHistoryLimit(): number {
    return this.getSettings().chatHistoryLimit;
  }

  getEditWindowSeconds(): number {
    return this.getSettings().editWindowSeconds;
  }

  async updateSettings(update: {
    chatHistoryLimit?: number;
    editWindowSeconds?: number;
  }): Promise<ChatSettings> {
    return this.updateSettingsService.execute(update);
  }
}
