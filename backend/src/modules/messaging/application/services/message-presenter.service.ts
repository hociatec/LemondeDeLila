import { Injectable } from '@nestjs/common';
import type { MessageDto } from '../models/message.record';
import type { PrivateMessageRecord } from '../models/private-message.model';

@Injectable()
export class MessagePresenterService {
  present(message: PrivateMessageRecord, viewerId: number): MessageDto {
    const direction = message.sender.id === viewerId ? 'sent' : 'received';
    const deletedAt =
      direction === 'sent'
        ? (message.deletedBySenderAt ?? null)
        : (message.deletedByRecipientAt ?? null);
    const boxType =
      deletedAt != null ? 'deleted' : direction === 'sent' ? 'outbox' : 'inbox';

    return {
      id: message.messageId,
      sender: { id: message.sender.id, username: message.sender.username },
      recipient: {
        id: message.recipient.id,
        username: message.recipient.username,
      },
      text: message.message,
      subject: message.subject ?? null,
      createdAt: message.createdAt.toISOString(),
      direction,
      deletedAt: deletedAt ? deletedAt.toISOString() : null,
      boxType,
    };
  }

  presentMany(
    messages: PrivateMessageRecord[],
    viewerId: number,
  ): MessageDto[] {
    return messages.map((message) => this.present(message, viewerId));
  }
}
