import { HttpException, Injectable } from '@nestjs/common';
import { MessagingService } from '../services/messaging.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { requireUser } from '../../common/ws/ws-auth';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { UserBadgeCountsService } from '../../notification/services/user-badge-counts.service';
import {
  MessagingConversationDto,
  MessagingListDto,
  MessagingMarkReadDto,
  MessagingSearchDto,
  MessagingSendDto,
} from './ws.dto';

@Injectable()
export class MessagingWsHandler {
  constructor(
    private readonly messaging: MessagingService,
    private readonly validator: PayloadValidationService,
    private readonly notifications: NotificationService,
    private readonly counts: UserBadgeCountsService,
  ) {}

  async conversation(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingConversationDto, payload);
    const items = await this.messaging.conversation(
      user.id,
      dto.userId,
      dto.limit,
    );
    return { type: 'messaging.conversation', payload: { items } };
  }

  async messages(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingListDto, payload);
    const { box, items } = await this.resolveBox(
      dto.box ?? 'inbox',
      user.id,
      dto.limit ?? 100,
    );
    return { type: 'messaging.messages', payload: { box, items } };
  }

  async send(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingSendDto, payload);
    const message = await this.messaging.send(user.id, dto as SendMessageDto);
    // Notification temps réel au destinataire (via WS notify).
    try {
      const preview =
        (message.text || '').trim().length > 0
          ? (message.text || '').trim().slice(0, 200)
          : '';
      await this.notifications.notifyUser(dto.recipientId, 'messaging.new', {
        messageId: message.id,
        from: message.sender,
        subject: message.subject,
        preview,
        createdAt: message.createdAt,
      });
      await this.counts.notifyCounts(dto.recipientId);
    } catch {
      // best-effort
    }
    return { type: 'messaging.message', payload: { message } };
  }

  async delete(session: WsSession, payload: any) {
    const user = requireUser(session);
    const messageId = String(payload?.messageId ?? payload?.id ?? '');
    const message = await this.messaging.delete(user.id, messageId);
    await this.counts.notifyCounts(user.id);
    return { type: 'messaging.deleted', payload: { message } };
  }

  async restore(session: WsSession, payload: any) {
    const user = requireUser(session);
    const messageId = String(payload?.messageId ?? payload?.id ?? '');
    const message = await this.messaging.restore(user.id, messageId);
    await this.counts.notifyCounts(user.id);
    return { type: 'messaging.restored', payload: { message } };
  }

  async purge(session: WsSession, payload: any) {
    const user = requireUser(session);
    const messageId = String(payload?.messageId ?? payload?.id ?? '');
    const message = await this.messaging.purge(user.id, messageId);
    await this.counts.notifyCounts(user.id);
    return { type: 'messaging.purged', payload: { message } };
  }

  async search(payload: any) {
    const dto = this.validator.validate(MessagingSearchDto, payload);
    const username = dto.username ?? dto.query ?? '';
    const user = await this.messaging.lookupUser(username);
    return { type: 'messaging.user', payload: { user } };
  }

  async markRead(session: WsSession, payload: any) {
    const user = requireUser(session);
    const dto = this.validator.validate(MessagingMarkReadDto, payload);
    await this.messaging.markRead(user.id, dto.messageId);
    await this.counts.notifyCounts(user.id);
    return { type: 'messaging.markRead', payload: { ok: true } };
  }

  private async resolveBox(
    box: string,
    userId: number,
    limit: number,
  ): Promise<{ box: string; items: any[] }> {
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
