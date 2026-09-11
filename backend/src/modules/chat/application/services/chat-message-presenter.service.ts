import { Injectable } from '@nestjs/common';
import { serializeDate } from '../../../../shared/utils/public-api';
import {
  ChatMessageRecord,
  ChatNormalizedMessage,
} from '../read-models/chat-message.record';

@Injectable()
export class ChatMessagePresenterService {
  normalize(message: ChatMessageRecord): ChatNormalizedMessage {
    return {
      id: message.messageId,
      text: message.message,
      createdAt: serializeDate(message.createdAt),
      user: {
        id: message.user?.id,
        username: message.user?.username,
        avatar: message.user?.avatar ?? null,
      },
    };
  }

  normalizeMany(messages: ChatMessageRecord[]): ChatNormalizedMessage[] {
    return messages.slice(0, 500).map((message) => this.normalize(message));
  }
}
