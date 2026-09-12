import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
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
import { isChatMutationWindowOpen } from '../../../domain/policies/chat-mutation-window';

@Injectable()
export class DeleteOwnChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly settings: ChatSettingsService,
    private readonly cache: ChatMessageCacheService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(userId: number, messageId: string): Promise<boolean> {
    const id = typeof messageId === 'string' ? messageId.trim() : '';
    if (!Number.isSafeInteger(userId) || userId <= 0 || !id || id.length > 128)
      return false;
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
    if (
      !isChatMutationWindowOpen(
        message.createdAt.getTime(),
        this.clock.now(),
        this.settings.getEditWindowSeconds(),
      )
    ) {
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
