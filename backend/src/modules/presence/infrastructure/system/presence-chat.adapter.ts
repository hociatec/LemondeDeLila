import { Injectable } from '@nestjs/common';
import { ChatService, ChatSettingsService } from '../../../chat/public-api';
import type { PresenceChatHistory } from '../../application/contracts/presence-chat-history.model';
import type { PresenceChatPort } from '../../application/ports/presence-chat.port';

@Injectable()
export class PresenceChatAdapter implements PresenceChatPort {
  constructor(
    private readonly chat: ChatService,
    private readonly chatSettings: ChatSettingsService,
  ) {}

  async getHistory(): Promise<PresenceChatHistory> {
    const limit = this.chatSettings.getChatHistoryLimit();
    const editWindowSeconds = this.chatSettings.getEditWindowSeconds();
    const messages = await this.chat.getRecentNormalizedMessages(limit);
    return {
      editWindowSeconds,
      messages,
    };
  }

  recordMessage(input: {
    userId: number;
    username: string;
    text: string;
  }): Promise<Record<string, unknown>> {
    return this.chat.recordMessageForBroadcast(
      { id: input.userId, username: input.username },
      input.text,
    );
  }

  editOwnMessage(
    userId: number,
    messageId: string,
    text: string,
  ): Promise<Record<string, unknown>> {
    return this.chat.editOwnMessage(userId, messageId, text);
  }

  deleteOwnMessage(userId: number, messageId: string): Promise<boolean> {
    return this.chat.deleteOwnMessage(userId, messageId);
  }
}
