import { Inject, Injectable } from '@nestjs/common';

import {
  CHAT_MESSAGE_REPOSITORY,
  type ChatMessageRepository,
} from '../../ports/chat-message.repository';
import { ChatMessageCacheService } from '../../services/chat-message-cache.service';

@Injectable()
export class AdminClearChatMessagesService {
  constructor(
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messages: ChatMessageRepository,
    private readonly cache: ChatMessageCacheService,
  ) {}

  async execute(): Promise<number> {
    const deleted = await this.messages.deleteAll();
    if (deleted > 0) {
      this.cache.clear();
    }
    return deleted;
  }
}
