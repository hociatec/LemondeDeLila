import { Injectable } from '@nestjs/common';

import { ChatNormalizedMessage } from '../../read-models/chat-message.record';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';
import { ChatMessagePresenterService } from '../../services/chat-message-presenter.service';
import { ListRecentChatMessagesService } from './list-recent-chat-messages.service';

@Injectable()
export class ListRecentNormalizedChatMessagesService {
  constructor(
    private readonly cache: ChatMessageCacheService,
    private readonly presenter: ChatMessagePresenterService,
    private readonly listRecentMessages: ListRecentChatMessagesService,
  ) {}

  async execute(
    limit = ListRecentChatMessagesService.DEFAULT_HISTORY_LIMIT,
  ): Promise<ChatNormalizedMessage[]> {
    const rows = await this.listRecentMessages.execute(
      ChatMessageCacheService.CACHE_LIMIT,
    );
    const messages = this.presenter.normalizeMany(rows);
    this.cache.setAll(messages);

    const safeLimit = Number.isSafeInteger(limit)
      ? Math.min(Math.max(limit, 1), ChatMessageCacheService.CACHE_LIMIT)
      : ListRecentChatMessagesService.DEFAULT_HISTORY_LIMIT;
    return messages.slice(-safeLimit);
  }
}
