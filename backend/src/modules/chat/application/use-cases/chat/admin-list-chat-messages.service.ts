import { Inject, Injectable } from '@nestjs/common';

import { ChatMessageRecord } from '../../read-models/chat-message.record';
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
    const safeLimit = Number.isSafeInteger(limit)
      ? Math.min(Math.max(limit, 1), ChatMessageCacheService.CACHE_LIMIT)
      : 200;
    return this.messages.listForAdmin(safeLimit, includeDeleted);
  }
}
