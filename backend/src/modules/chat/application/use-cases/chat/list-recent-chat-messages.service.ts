import { Inject, Injectable } from '@nestjs/common';

import { ChatMessageRecord } from '../../contracts/chat-message.record';
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
    return this.messages.listRecent(
      Math.min(Math.max(limit, 1), ChatMessageCacheService.CACHE_LIMIT),
      since,
    );
  }
}
