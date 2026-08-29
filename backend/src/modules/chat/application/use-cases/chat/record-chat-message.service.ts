import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';

import {
  ChatBroadcastUser,
  ChatNormalizedMessage,
} from '../../models/chat-message.record';
import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatValidator } from './chat.validator';

@Injectable()
export class RecordChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly validator: ChatValidator,
    private readonly cache: ChatMessageCacheService,
  ) {}

  async execute(
    user: ChatBroadcastUser,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    const sanitized = this.validator.validate(text);
    const messageId = randomBytes(8).toString('hex');
    const createdAt = new Date();

    await this.messages.create({
      userId: user.id,
      message: sanitized,
      messageId,
      createdAt,
    });

    const normalized: ChatNormalizedMessage = {
      id: messageId,
      text: sanitized,
      createdAt: createdAt.toISOString(),
      user: {
        id: user.id,
        username: user.username,
        avatar: null,
      },
    };

    this.cache.append(normalized);
    return normalized;
  }
}
