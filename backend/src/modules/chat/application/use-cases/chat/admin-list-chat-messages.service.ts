import { Inject, Injectable } from '@nestjs/common';

import { ChatMessageRecord } from '../../models/chat-message.record';
import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';

@Injectable()
export class AdminListChatMessagesService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
  ) {}

  async execute(
    limit = 200,
    includeDeleted = false,
  ): Promise<ChatMessageRecord[]> {
    return this.messages.listForAdmin(
      Math.min(Math.max(limit, 1), ChatMessageCacheService.CACHE_LIMIT),
      includeDeleted,
    );
  }
}
