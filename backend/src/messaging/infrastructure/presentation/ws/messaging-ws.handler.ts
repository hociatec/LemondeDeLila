import { HttpException, Injectable } from '@nestjs/common';
import type { PrivateMessageRecord } from '../../../application/models/private-message.model';
import { PrivateMessagingService } from '../../../application/services/private-messaging.service';
import { MessagePresenterService } from '../../../application/services/message-presenter.service';
import { MessagingWsNotificationService } from './messaging-ws-notification.service';
import { WS_EVENTS } from '../../../../realtime/public-api';
import {
  MessagingConversationDto,
  MessagingListDto,
  MessagingMessageActionDto,
  MessagingMarkReadDto,
  MessagingSearchDto,
  MessagingSendDto,
} from './dto/messaging-ws.dto';
import { PayloadValidationService } from '../../../../common/validation/public-api';
import { requireUser } from '../../../../realtime/public-api';
import type { WsSession } from '../../../../realtime/public-api';

@Injectable()
export class MessagingWsHandler {
  constructor(
    private readonly messaging: PrivateMessagingService,
    private readonly presenter: MessagePresenterService,
    private readonly validator: PayloadValidationService,
    private readonly notifier: MessagingWsNotificationService,
  ) {}

  async conversation(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingConversationDto, payload);
    const items = await this.messaging.conversation(
      user.id,
      dto.userId,
      dto.limit,
    );
    return {
      type: WS_EVENTS.messaging.conversation,
      payload: { items: this.presenter.presentMany(items, user.id) },
    };
  }

  async messages(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingListDto, payload);
    const { box, items } = await this.resolveBox(
      dto.box ?? 'inbox',
      user.id,
      dto.limit ?? 100,
    );
    return {
      type: WS_EVENTS.messaging.messages,
      payload: { box, items: this.presenter.presentMany(items, user.id) },
    };
  }

  async send(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingSendDto, payload);
    const message = await this.messaging.send(user.id, dto);
    await this.notifier.notifyMessageSent(dto.recipientId, message);
    return {
      type: WS_EVENTS.messaging.messageSent,
      payload: { message: this.presenter.present(message, user.id) },
    };
  }

  async delete(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.delete(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return {
      type: WS_EVENTS.messaging.messageDeleted,
      payload: { message: this.presenter.present(message, user.id) },
    };
  }

  async restore(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.restore(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return {
      type: WS_EVENTS.messaging.messageRestored,
      payload: { message: this.presenter.present(message, user.id) },
    };
  }

  async purge(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.purge(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return {
      type: WS_EVENTS.messaging.messagePurged,
      payload: { message: this.presenter.present(message, user.id) },
    };
  }

  async search(payload: unknown) {
    const dto = this.validator.validate(MessagingSearchDto, payload);
    const username = dto.username ?? dto.query ?? '';
    const user = await this.messaging.lookupUser(username);
    return { type: WS_EVENTS.messaging.user, payload: { user } };
  }

  async markRead(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMarkReadDto, payload);
    await this.messaging.markRead(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return { type: WS_EVENTS.messaging.markRead, payload: { ok: true } };
  }

  private async resolveBox(
    box: string,
    userId: number,
    limit: number,
  ): Promise<{ box: string; items: PrivateMessageRecord[] }> {
    const normalized = (box || 'inbox').toLowerCase();
    const mapping: Record<string, 'inbox' | 'outbox' | 'deleted'> = {
      inbox: 'inbox',
      received: 'inbox',
      '': 'inbox',
      sent: 'outbox',
      outbox: 'outbox',
      deleted: 'deleted',
      trash: 'deleted',
    };
    const target = mapping[normalized];
    if (!target) {
      throw new HttpException('Boite de messagerie inconnue', 404);
    }
    const items =
      target === 'outbox'
        ? await this.messaging.outbox(userId, limit)
        : target === 'deleted'
          ? await this.messaging.deleted(userId, limit)
          : await this.messaging.inbox(userId, limit);
    const finalBox =
      normalized === ''
        ? 'inbox'
        : normalized === 'sent'
          ? 'outbox'
          : normalized;
    return { box: finalBox, items };
  }
}

