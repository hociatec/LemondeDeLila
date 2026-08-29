import { Injectable } from '@nestjs/common';

import { ChatNormalizedMessage } from '../../models/chat-message.record';
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
    let messages = this.cache.getAll();
    if (messages === null) {
      const rows = await this.listRecentMessages.execute(
        ChatMessageCacheService.CACHE_LIMIT,
      );
      messages = this.presenter.normalizeMany(rows);
      this.cache.setAll(messages);
    }

    const safeLimit = Math.min(
      Math.max(limit, 1),
      ChatMessageCacheService.CACHE_LIMIT,
    );
    return messages.slice(-safeLimit);
  }
}
