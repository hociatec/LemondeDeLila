import { Inject, Injectable } from '@nestjs/common';

import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import {
  ChatMessageAccessDeniedError,
  ChatMessageDeleteWindowExpiredError,
  ChatMessageNotFoundError,
} from '../../../domain/errors/chat-domain.errors';
import { ChatSettingsService } from './chat-settings.service';

@Injectable()
export class DeleteOwnChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly settings: ChatSettingsService,
    private readonly cache: ChatMessageCacheService,
  ) {}

  async execute(userId: number, messageId: string): Promise<boolean> {
    const id = (messageId || '').trim();
    if (!id) return false;
    const message = await this.messages.findByMessageId(id);
    if (!message || !message.user?.id) {
      throw new ChatMessageNotFoundError();
    }
    if (message.user.id !== userId) {
      throw new ChatMessageAccessDeniedError(
        'Vous ne pouvez supprimer que vos messages.',
      );
    }
    if (message.deletedAt) {
      return true;
    }
    const ageMs = Date.now() - message.createdAt.getTime();
    const windowMs = this.settings.getEditWindowSeconds() * 1000;
    if (windowMs <= 0 || ageMs > windowMs) {
      throw new ChatMessageDeleteWindowExpiredError(
        'Message trop ancien pour être supprimé.',
      );
    }

    const deleted = await this.messages.deleteById(message.id);
    if (deleted) {
      this.cache.remove(id);
    }
    return deleted;
  }
}
