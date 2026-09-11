import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';

import {
  ChatBroadcastUser,
  ChatNormalizedMessage,
} from '../../read-models/chat-message.record';
import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatValidator } from './chat.validator';
import { asMessageId } from '../../../../../shared/interfaces/public-api';
import { businessMsToDate } from '../../../../../shared/utils/public-api';

@Injectable()
export class RecordChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly validator: ChatValidator,
    private readonly cache: ChatMessageCacheService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async execute(
    user: ChatBroadcastUser,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    if (
      !user ||
      !Number.isSafeInteger(user.id) ||
      user.id <= 0 ||
      typeof user.username !== 'string' ||
      user.username.length > 255
    ) {
      throw new RangeError('Utilisateur chat invalide');
    }
    const sanitized = this.validator.validate(text);
    const messageId = randomBytes(8).toString('hex');
    const createdAt = businessMsToDate(this.clock.now());

    await this.messages.create({
      userId: user.id,
      message: sanitized,
      messageId,
      createdAt,
    });

    const normalized: ChatNormalizedMessage = {
      id: asMessageId(messageId),
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
