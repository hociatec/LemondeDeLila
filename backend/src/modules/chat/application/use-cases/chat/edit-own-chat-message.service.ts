import { Inject, Injectable } from '@nestjs/common';

import { ChatNormalizedMessage } from '../../contracts/chat-message.record';
import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatMessagePresenterService } from '../../services/chat-message-presenter.service';
import {
  ChatMessageAccessDeniedError,
  ChatMessageDeletedError,
  ChatMessageEditWindowExpiredError,
  ChatMessageNotFoundError,
} from '../../../domain/errors/chat-domain.errors';
import { ChatSettingsService } from './chat-settings.service';
import { ChatValidator } from './chat.validator';

@Injectable()
export class EditOwnChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly validator: ChatValidator,
    private readonly settings: ChatSettingsService,
    private readonly presenter: ChatMessagePresenterService,
    private readonly cache: ChatMessageCacheService,
  ) {}

  async execute(
    userId: number,
    messageId: string,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    const id = (messageId || '').trim();
    if (!id) {
      throw new ChatMessageNotFoundError();
    }
    const message = await this.messages.findByMessageId(id);
    if (!message || !message.user?.id) {
      throw new ChatMessageNotFoundError();
    }
    if (message.user.id !== userId) {
      throw new ChatMessageAccessDeniedError(
        'Vous ne pouvez modifier que vos messages.',
      );
    }
    if (message.deletedAt) {
      throw new ChatMessageDeletedError('Message supprimé.');
    }
    const ageMs = Date.now() - message.createdAt.getTime();
    const windowMs = this.settings.getEditWindowSeconds() * 1000;
    if (windowMs <= 0 || ageMs > windowMs) {
      throw new ChatMessageEditWindowExpiredError(
        'Message trop ancien pour être modifié.',
      );
    }

    const updated = await this.messages.updateMessage(
      message.id,
      this.validator.validate(text),
    );

    const normalized = this.presenter.normalize(updated);
    this.cache.replace(normalized);
    return normalized;
  }
}
