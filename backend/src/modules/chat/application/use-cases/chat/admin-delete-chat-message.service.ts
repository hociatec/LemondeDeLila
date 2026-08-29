import { Inject, Injectable } from '@nestjs/common';

import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';

@Injectable()
export class AdminDeleteChatMessageService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly cache: ChatMessageCacheService,
  ) {}

  async execute(messageId: string): Promise<boolean> {
    const id = (messageId || '').trim();
    if (!id) return false;
    const deleted = await this.messages.deleteByMessageId(id);
    if (deleted) {
      this.cache.remove(id);
    }
    return deleted;
  }
}
