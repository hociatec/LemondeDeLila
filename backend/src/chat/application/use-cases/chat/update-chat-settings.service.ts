import { Inject, Injectable } from '@nestjs/common';

import { ChatSettings } from '../../models/chat-settings.record';
import {
  CHAT_SETTINGS_REPOSITORY,
  type ChatSettingsRepository,
} from '../../ports/chat-settings.repository';
import { ChatSettingsPolicyService } from '../../services/chat-settings-policy.service';
import { GetChatSettingsService } from './get-chat-settings.service';

@Injectable()
export class UpdateChatSettingsService {
  constructor(
    @Inject(CHAT_SETTINGS_REPOSITORY)
    private readonly repo: ChatSettingsRepository,
    private readonly policy: ChatSettingsPolicyService,
    private readonly settings: GetChatSettingsService,
  ) {}

  async execute(update: {
    chatHistoryLimit?: number;
    editWindowSeconds?: number;
  }): Promise<ChatSettings> {
    await this.settings.ensureSeeded();
    const current = this.settings.getCached();
    const next: ChatSettings = { ...current };

    if (update.chatHistoryLimit !== undefined) {
      next.chatHistoryLimit = this.policy.clampHistoryLimit(
        update.chatHistoryLimit,
      );
    }
    if (update.editWindowSeconds !== undefined) {
      next.editWindowSeconds = this.policy.clampEditWindowSeconds(
        update.editWindowSeconds,
      );
    }

    await this.repo.save(next);

    this.settings.setCached(next);
    return next;
  }
}
