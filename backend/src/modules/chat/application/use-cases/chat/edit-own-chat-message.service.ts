import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import { Inject, Injectable } from '@nestjs/common';

import { ChatNormalizedMessage } from '../../read-models/chat-message.record';
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
import { isChatMutationWindowOpen } from '../../../domain/policies/chat-mutation-window';

@Injectable()
export class EditOwnChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly validator: ChatValidator,
    private readonly settings: ChatSettingsService,
    private readonly presenter: ChatMessagePresenterService,
    private readonly cache: ChatMessageCacheService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(
    userId: number,
    messageId: string,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    const id = typeof messageId === 'string' ? messageId.trim() : '';
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      !id ||
      id.length > 128
    ) {
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
    if (
      !isChatMutationWindowOpen(
        message.createdAt.getTime(),
        this.clock.now(),
        this.settings.getEditWindowSeconds(),
      )
    ) {
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
