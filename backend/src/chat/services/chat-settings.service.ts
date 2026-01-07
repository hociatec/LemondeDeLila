import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSettingsEntity } from '../entities/chat-settings.entity';

export type ChatSettings = {
  chatHistoryLimit: number;
  editWindowSeconds: number;
};

@Injectable()
export class ChatSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ChatSettingsService.name);
  private cache: ChatSettings | null = null;

  private static readonly DEFAULT_HISTORY_LIMIT = 200;
  private static readonly MIN_HISTORY_LIMIT = 1;
  private static readonly MAX_HISTORY_LIMIT = 2000;
  private static readonly DEFAULT_EDIT_WINDOW_SECONDS = 5 * 60;
  private static readonly MIN_EDIT_WINDOW_SECONDS = 0;
  private static readonly MAX_EDIT_WINDOW_SECONDS = 24 * 60 * 60;

  constructor(
    @InjectRepository(ChatSettingsEntity)
    private readonly repo: Repository<ChatSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  getSettings(): ChatSettings {
    return (
      this.cache ?? {
        chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT,
        editWindowSeconds: ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS,
      }
    );
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
    await this.ensureSeeded();
    const current = this.getSettings();
    const next: ChatSettings = { ...current };
    if (update.chatHistoryLimit !== undefined) {
      next.chatHistoryLimit = this.clampHistoryLimit(update.chatHistoryLimit);
    }
    if (update.editWindowSeconds !== undefined) {
      next.editWindowSeconds = this.clampEditWindowSeconds(
        update.editWindowSeconds,
      );
    }

    await this.repo.save({
      id: 1,
      chatHistoryLimit: next.chatHistoryLimit,
      editWindowSeconds: next.editWindowSeconds,
    });
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

  private clampEditWindowSeconds(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS;
    }
    const rounded = Math.round(candidate);
    if (rounded < ChatSettingsService.MIN_EDIT_WINDOW_SECONDS) {
      return ChatSettingsService.MIN_EDIT_WINDOW_SECONDS;
    }
    if (rounded > ChatSettingsService.MAX_EDIT_WINDOW_SECONDS) {
      return ChatSettingsService.MAX_EDIT_WINDOW_SECONDS;
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
          editWindowSeconds: this.clampEditWindowSeconds(
            existing.editWindowSeconds ??
              ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS,
          ),
        };
        return;
      }

      const limit = ChatSettingsService.DEFAULT_HISTORY_LIMIT;
      const editWindowSeconds = ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS;
      await this.repo.insert({
        id: 1,
        chatHistoryLimit: limit,
        editWindowSeconds,
      });
      this.cache = { chatHistoryLimit: limit, editWindowSeconds };
      return;
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser chat_settings: ${(error as Error).message}`,
      );
    }

    this.cache = {
      chatHistoryLimit: ChatSettingsService.DEFAULT_HISTORY_LIMIT,
      editWindowSeconds: ChatSettingsService.DEFAULT_EDIT_WINDOW_SECONDS,
    };
  }
}
