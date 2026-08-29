import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChatSettings } from '../../../../application/models/chat-settings.record';
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
      chatHistoryLimit: existing.chatHistoryLimit,
      editWindowSeconds: existing.editWindowSeconds,
    };
  }

  async createDefaults(settings: ChatSettings): Promise<void> {
    await this.repo.insert({ id: 1, ...settings });
  }

  async save(settings: ChatSettings): Promise<void> {
    await this.repo.save({
      id: 1,
      chatHistoryLimit: settings.chatHistoryLimit,
      editWindowSeconds: settings.editWindowSeconds,
    });
  }
}
