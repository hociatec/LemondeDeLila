import { Injectable } from '@nestjs/common';
import {
  ChatMessageRecord,
  ChatNormalizedMessage,
} from '../models/chat-message.record';

@Injectable()
export class ChatMessagePresenterService {
  normalize(message: ChatMessageRecord): ChatNormalizedMessage {
    const created =
      message.createdAt instanceof Date ? message.createdAt : new Date();
    const createdAt = isFinite(created.getTime())
      ? created.toISOString()
      : new Date().toISOString();

    return {
      id: message.messageId,
      text: message.message,
      createdAt,
      user: {
        id: message.user?.id,
        username: message.user?.username,
        avatar: message.user?.avatar ?? null,
      },
    };
  }

  normalizeMany(messages: ChatMessageRecord[]): ChatNormalizedMessage[] {
    return messages.map((message) => this.normalize(message));
  }
}
