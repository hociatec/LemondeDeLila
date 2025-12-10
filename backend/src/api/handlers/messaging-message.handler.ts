import { HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MessagingService } from '../../messaging/services/messaging.service';
import { SendMessageDto } from '../../messaging/dto/send-message.dto';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { PayloadValidationService } from '../services/payload-validation.service';
import { MessagingConversationDto } from '../dto/messaging-conversation.dto';
import { MessagingListDto } from '../dto/messaging-list.dto';
import { MessagingSendDto } from '../dto/messaging-send.dto';
import { MessagingSearchDto } from '../dto/messaging-search.dto';

type ClientSession = { user: WsAuthPayload | null };

@Injectable()
export class MessagingMessageHandler {
  constructor(
    private readonly messaging: MessagingService,
    private readonly validator: PayloadValidationService,
  ) {}

  async conversation(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(MessagingConversationDto, payload);
    const items = await this.messaging.conversation(user.id, dto.userId, dto.limit);
    return { type: 'messaging.conversation', payload: { items } };
  }

  async messages(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(MessagingListDto, payload);
    const { box, items } = await this.resolveBox(dto.box ?? 'inbox', user.id, dto.limit ?? 100);
    return { type: 'messaging.messages', payload: { box, items } };
  }

  async send(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const dto = this.validator.validate(MessagingSendDto, payload);
    const message = await this.messaging.send(user.id, dto as SendMessageDto);
    return { type: 'messaging.message', payload: { message } };
  }

  async delete(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const messageId = String(payload?.messageId ?? payload?.id ?? '');
    const message = await this.messaging.delete(user.id, messageId);
    return { type: 'messaging.deleted', payload: { message } };
  }

  async restore(session: ClientSession, payload: any) {
    const user = this.requireUser(session);
    const messageId = String(payload?.messageId ?? payload?.id ?? '');
    const message = await this.messaging.restore(user.id, messageId);
    return { type: 'messaging.restored', payload: { message } };
  }

  async search(payload: any) {
    const dto = this.validator.validate(MessagingSearchDto, payload);
    const username = dto.username ?? dto.query ?? '';
    const user = await this.messaging.lookupUser(username);
    return { type: 'messaging.user', payload: { user } };
  }

  private requireUser(session: ClientSession): WsAuthPayload {
    if (!session.user?.id) {
      throw new UnauthorizedException('Authentification requise');
    }
    return session.user;
  }

  private async resolveBox(box: string, userId: number, limit: number): Promise<{ box: string; items: any[] }> {
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
    const finalBox = normalized === '' ? 'inbox' : normalized === 'sent' ? 'outbox' : normalized;
    return { box: finalBox, items };
  }
}
