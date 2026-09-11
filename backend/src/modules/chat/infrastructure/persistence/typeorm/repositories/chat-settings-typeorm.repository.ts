import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChatSettings } from '../../../../application/read-models/chat-settings.record';
import { ChatSettingsRepository } from '../../../../application/ports/chat-settings.repository';
import { ChatSettingsEntity } from '../entities/chat-settings.entity';

@Injectable()
export class ChatSettingsTypeormRepository implements ChatSettingsRepository {
  constructor(
    @InjectRepository(ChatSettingsEntity)
    private readonly repo: Repository<ChatSettingsEntity>,
  ) {}

  async find(): Promise<ChatSettings | null> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (!existing) {
      return null;
    }

    return {
      chatHistoryLimit: Number.isSafeInteger(existing.chatHistoryLimit)
        ? Math.max(1, Math.min(2_000, existing.chatHistoryLimit))
        : 200,
      editWindowSeconds: Number.isSafeInteger(existing.editWindowSeconds)
        ? Math.max(0, Math.min(86_400, existing.editWindowSeconds))
        : 300,
    };
  }

  async createDefaults(settings: ChatSettings): Promise<void> {
    await this.repo.insert({ id: 1, ...normalizeSettings(settings) });
  }

  async save(settings: ChatSettings): Promise<void> {
    await this.repo.save({
      id: 1,
      ...normalizeSettings(settings),
    });
  }
}

function normalizeSettings(settings: ChatSettings): ChatSettings {
  return {
    chatHistoryLimit: Number.isSafeInteger(settings.chatHistoryLimit)
      ? Math.max(1, Math.min(2_000, settings.chatHistoryLimit))
      : 200,
    editWindowSeconds: Number.isSafeInteger(settings.editWindowSeconds)
      ? Math.max(0, Math.min(86_400, settings.editWindowSeconds))
      : 300,
  };
}
