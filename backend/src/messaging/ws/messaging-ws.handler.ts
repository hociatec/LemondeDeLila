import { HttpException, Injectable } from '@nestjs/common';
import { SendMessageDto } from '../dto/send-message.dto';
import { MessagingService } from '../services/messaging.service';
import { MessagingNotificationService } from '../services/messaging-notification.service';
import {
  MessagingConversationDto,
  MessagingListDto,
  MessagingMessageActionDto,
  MessagingMarkReadDto,
  MessagingSearchDto,
  MessagingSendDto,
} from './ws.dto';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';

@Injectable()
export class MessagingWsHandler {
  constructor(
    private readonly messaging: MessagingService,
    private readonly validator: PayloadValidationService,
    private readonly notifier: MessagingNotificationService,
  ) {}

  async conversation(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingConversationDto, payload);
    const items = await this.messaging.conversation(
      user.id,
      dto.userId,
      dto.limit,
    );
    return { type: 'messaging.conversation', payload: { items } };
  }

  async messages(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingListDto, payload);
    const { box, items } = await this.resolveBox(
      dto.box ?? 'inbox',
      user.id,
      dto.limit ?? 100,
    );
    return { type: 'messaging.messages', payload: { box, items } };
  }

  async send(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingSendDto, payload);
    const message = await this.messaging.send(user.id, dto as SendMessageDto);
    await this.notifier.notifyMessageSent(dto.recipientId, message);
    return { type: 'messaging.message', payload: { message } };
  }

  async delete(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.delete(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return { type: 'messaging.deleted', payload: { message } };
  }

  async restore(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.restore(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return { type: 'messaging.restored', payload: { message } };
  }

  async purge(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMessageActionDto, payload);
    const message = await this.messaging.purge(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return { type: 'messaging.purged', payload: { message } };
  }

  async search(payload: unknown) {
    const dto = this.validator.validate(MessagingSearchDto, payload);
    const username = dto.username ?? dto.query ?? '';
    const user = await this.messaging.lookupUser(username);
    return { type: 'messaging.user', payload: { user } };
  }

  async markRead(session: WsSession, payload: unknown) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMarkReadDto, payload);
    await this.messaging.markRead(user.id, dto.messageId);
    await this.notifier.notifyCountsBestEffort(user.id);
    return { type: 'messaging.markRead', payload: { ok: true } };
  }

  private async resolveBox(
    box: string,
    userId: number,
    limit: number,
  ): Promise<{ box: string; items: unknown[] }> {
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
