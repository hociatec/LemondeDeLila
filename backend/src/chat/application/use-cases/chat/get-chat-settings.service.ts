import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { getErrorMessage } from '@common/utils/public-api';

import { ChatSettings } from '../../models/chat-settings.record';
import {
  CHAT_SETTINGS_REPOSITORY,
  type ChatSettingsRepository,
} from '../../ports/chat-settings.repository';
import { ChatSettingsPolicyService } from '../../services/chat-settings-policy.service';

@Injectable()
export class GetChatSettingsService implements OnModuleInit {
  private readonly logger = new Logger(GetChatSettingsService.name);
  private cache: ChatSettings | null = null;

  constructor(
    @Inject(CHAT_SETTINGS_REPOSITORY)
    private readonly repo: ChatSettingsRepository,
    private readonly policy: ChatSettingsPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  getCached(): ChatSettings {
    return (
      this.cache ?? {
        chatHistoryLimit: ChatSettingsPolicyService.DEFAULT_HISTORY_LIMIT,
        editWindowSeconds:
          ChatSettingsPolicyService.DEFAULT_EDIT_WINDOW_SECONDS,
      }
    );
  }

  setCached(settings: ChatSettings): void {
    this.cache = settings;
  }

  async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    try {
      const existing = await this.repo.find();
      if (existing) {
        this.cache = {
          chatHistoryLimit: this.policy.clampHistoryLimit(
            existing.chatHistoryLimit,
          ),
          editWindowSeconds: this.policy.clampEditWindowSeconds(
            existing.editWindowSeconds ??
              ChatSettingsPolicyService.DEFAULT_EDIT_WINDOW_SECONDS,
          ),
        };
        return;
      }

      const defaults: ChatSettings = {
        chatHistoryLimit: ChatSettingsPolicyService.DEFAULT_HISTORY_LIMIT,
        editWindowSeconds:
          ChatSettingsPolicyService.DEFAULT_EDIT_WINDOW_SECONDS,
      };
      await this.repo.createDefaults(defaults);
      this.cache = defaults;
      return;
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser chat_settings: ${getErrorMessage(error)}`,
      );
    }

    this.cache = {
      chatHistoryLimit: ChatSettingsPolicyService.DEFAULT_HISTORY_LIMIT,
      editWindowSeconds: ChatSettingsPolicyService.DEFAULT_EDIT_WINDOW_SECONDS,
    };
  }
}
