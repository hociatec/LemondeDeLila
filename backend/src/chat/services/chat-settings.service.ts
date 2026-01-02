import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSettingsEntity } from '../entities/chat-settings.entity';

export type ChatSettings = {
  chatHistoryLimit: number;
};

@Injectable()
export class ChatSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ChatSettingsService.name);
  private cache: ChatSettings | null = null;

  private static readonly DEFAULT_HISTORY_LIMIT = 200;
  private static readonly MIN_HISTORY_LIMIT = 1;
  private static readonly MAX_HISTORY_LIMIT = 2000;

  constructor(
    @InjectRepository(ChatSettingsEntity)
    private readonly repo: Repository<ChatSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  getSettings(): ChatSettings {
    return this.cache ?? { chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT };
  }

  getChatHistoryLimit(): number {
    return this.getSettings().chatHistoryLimit;
  }

  async updateSettings(update: { chatHistoryLimit?: number }): Promise<ChatSettings> {
    await this.ensureSeeded();
    const current = this.getSettings();
    const next: ChatSettings = { ...current };
    if (update.chatHistoryLimit !== undefined) {
      next.chatHistoryLimit = this.clampHistoryLimit(update.chatHistoryLimit);
    }
    await this.repo.save({ id: 1, chatHistoryLimit: next.chatHistoryLimit });
    this.cache = next;
    return next;
  }

  private clampHistoryLimit(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return ChatSettingsService.DEFAULT_HISTORY_LIMIT;
    }
    const rounded = Math.round(candidate);
    if (rounded < ChatSettingsService.MIN_HISTORY_LIMIT) {
      return ChatSettingsService.MIN_HISTORY_LIMIT;
    }
    if (rounded > ChatSettingsService.MAX_HISTORY_LIMIT) {
      return ChatSettingsService.MAX_HISTORY_LIMIT;
    }
    return rounded;
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    try {
      const existing = await this.repo.findOne({ where: { id: 1 } });
      if (existing) {
        this.cache = {
          chatHistoryLimit: this.clampHistoryLimit(existing.chatHistoryLimit),
        };
        return;
      }

      const limit = ChatSettingsService.DEFAULT_HISTORY_LIMIT;
      await this.repo.insert({ id: 1, chatHistoryLimit: limit });
      this.cache = { chatHistoryLimit: limit };
      return;
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser chat_settings: ${(error as Error).message}`,
      );
    }

    this.cache = { chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT };
  }
}
