import { Inject, Injectable } from '@nestjs/common';

import { ChatMessageRecord } from '../../read-models/chat-message.record';
import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';

@Injectable()
export class ListRecentChatMessagesService {
  static readonly DEFAULT_HISTORY_LIMIT = 200;

  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
  ) {}

  async execute(
    limit = ListRecentChatMessagesService.DEFAULT_HISTORY_LIMIT,
    since?: Date,
  ): Promise<ChatMessageRecord[]> {
    const safeLimit = Number.isSafeInteger(limit)
      ? Math.min(Math.max(limit, 1), ChatMessageCacheService.CACHE_LIMIT)
      : ListRecentChatMessagesService.DEFAULT_HISTORY_LIMIT;
    return this.messages.listRecent(safeLimit, since);
  }
}
