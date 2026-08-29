import { Injectable } from '@nestjs/common';

import {
  ChatBroadcastUser,
  ChatMessageRecord,
  ChatNormalizedMessage,
} from '../../models/chat-message.record';
import { AdminClearChatMessagesService } from './admin-clear-chat-messages.service';
import { AdminDeleteChatMessageService } from './admin-delete-chat-message.service';
import { AdminListChatMessagesService } from './admin-list-chat-messages.service';
import { DeleteOwnChatMessageService } from './delete-own-chat-message.service';
import { EditOwnChatMessageService } from './edit-own-chat-message.service';
import { ListRecentChatMessagesService } from './list-recent-chat-messages.service';
import { ListRecentNormalizedChatMessagesService } from './list-recent-normalized-chat-messages.service';
import { RecordChatMessageService } from './record-chat-message.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly recordMessage: RecordChatMessageService,
    private readonly editMessage: EditOwnChatMessageService,
    private readonly deleteMessage: DeleteOwnChatMessageService,
    private readonly listRecentMessagesService: ListRecentChatMessagesService,
    private readonly listRecentNormalizedMessagesService: ListRecentNormalizedChatMessagesService,
    private readonly adminListMessagesService: AdminListChatMessagesService,
    private readonly adminDeleteMessageService: AdminDeleteChatMessageService,
    private readonly adminClearMessagesService: AdminClearChatMessagesService,
  ) {}

  async recordMessageForBroadcast(
    user: ChatBroadcastUser,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    return this.recordMessage.execute(user, text);
  }

  async editOwnMessage(
    userId: number,
    messageId: string,
    text: string,
  ): Promise<ChatNormalizedMessage> {
    return this.editMessage.execute(userId, messageId, text);
  }

  async deleteOwnMessage(userId: number, messageId: string): Promise<boolean> {
    return this.deleteMessage.execute(userId, messageId);
  }

  async getRecentMessages(
    limit = 200,
    since?: Date,
  ): Promise<ChatMessageRecord[]> {
    return this.listRecentMessagesService.execute(limit, since);
  }

  async getRecentNormalizedMessages(
    limit = 200,
  ): Promise<ChatNormalizedMessage[]> {
    return this.listRecentNormalizedMessagesService.execute(limit);
  }

  async adminListMessages(
    limit = 200,
    includeDeleted = false,
  ): Promise<ChatMessageRecord[]> {
    return this.adminListMessagesService.execute(limit, includeDeleted);
  }

  async adminDeleteMessage(messageId: string): Promise<boolean> {
    return this.adminDeleteMessageService.execute(messageId);
  }

  async adminClearAll(): Promise<number> {
    return this.adminClearMessagesService.execute();
  }
}
