import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import type { PrivateMessageRecord } from '../models/private-message.model';
import { businessMsToDate } from '../../../../shared/utils/public-api';
import type { MessageUser } from '../models/message-user.model';
import type { SendMessageInput } from '../inputs/send-message.input';
import {
  MESSAGING_USER_READER,
  type MessagingUserReader,
} from '../ports/messaging-user.repository';
import {
  PRIVATE_MESSAGE_REPOSITORY,
  type PrivateMessageRepository,
} from '../ports/private-message.repository';
import { MessageValidatorService } from './message-validator.service';

@Injectable()
export class PrivateMessagingService {
  private static readonly DEFAULT_HISTORY_LIMIT = 100;

  constructor(
    @Inject(PRIVATE_MESSAGE_REPOSITORY)
    private readonly messages: PrivateMessageRepository,
    @Inject(MESSAGING_USER_READER)
    private readonly users: MessagingUserReader,
    private readonly validator: MessageValidatorService,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async send(
    senderId: number,
    payload: SendMessageInput,
  ): Promise<PrivateMessageRecord> {
    if (!Number.isSafeInteger(senderId) || senderId <= 0) {
      throw new BadRequestException('Expéditeur invalide');
    }
    const sender = await this.ensureUser(senderId);
    if (sender.id === payload.recipientId) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer un message',
      );
    }
    const recipient = await this.users.findById(payload.recipientId);
    if (!recipient) {
      throw new NotFoundException('Destinataire introuvable');
    }

    const sanitized = this.validator.validate(payload.text);
    const subject = this.validator.validateSubject(payload.subject);
    const message = await this.messages.create({
      senderId: sender.id,
      recipientId: recipient.id,
      messageId: this.generateMessageId(),
      message: sanitized,
      subject,
    });
    return message;
  }

  async conversation(
    currentId: number,
    otherUserId: number,
    limit = PrivateMessagingService.DEFAULT_HISTORY_LIMIT,
  ) {
    if (currentId === otherUserId) {
      return [];
    }
    const other = await this.users.findById(otherUserId);
    if (!other) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const clamped = this.clampLimit(limit);
    const items = await this.messages.findConversation(
      currentId,
      otherUserId,
      clamped,
    );
    return items;
  }

  async inbox(
    userId: number,
    limit = PrivateMessagingService.DEFAULT_HISTORY_LIMIT,
  ): Promise<PrivateMessageRecord[]> {
    const clamped = this.clampLimit(limit);
    return this.messages.findInbox(userId, clamped);
  }

  async outbox(
    userId: number,
    limit = PrivateMessagingService.DEFAULT_HISTORY_LIMIT,
  ): Promise<PrivateMessageRecord[]> {
    const clamped = this.clampLimit(limit);
    return this.messages.findOutbox(userId, clamped);
  }

  async deleted(
    userId: number,
    limit = PrivateMessagingService.DEFAULT_HISTORY_LIMIT,
  ): Promise<PrivateMessageRecord[]> {
    const clamped = this.clampLimit(limit);
    return this.messages.findDeleted(userId, clamped);
  }

  async delete(
    userId: number,
    messageId: string,
  ): Promise<PrivateMessageRecord> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof messageId !== 'string' ||
      messageId.length > 128
    ) {
      throw new BadRequestException('Message invalide');
    }
    const message = await this.messages.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    const isSender = message.sender.id === userId;
    const isRecipient = message.recipient.id === userId;
    if (!isSender && !isRecipient) {
      throw new ForbiddenException('Non autorise');
    }
    let changed = false;
    if (isSender && !message.deletedBySenderAt) {
      message.deletedBySenderAt = businessMsToDate(this.clock.now());
      changed = true;
    }
    if (isRecipient && !message.deletedByRecipientAt) {
      message.deletedByRecipientAt = businessMsToDate(this.clock.now());
      changed = true;
    }
    if (changed) {
      await this.messages.save(message);
    }
    return message;
  }

  async restore(
    userId: number,
    messageId: string,
  ): Promise<PrivateMessageRecord> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof messageId !== 'string' ||
      messageId.length > 128
    ) {
      throw new BadRequestException('Message invalide');
    }
    const message = await this.messages.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    const isSender = message.sender.id === userId;
    const isRecipient = message.recipient.id === userId;
    if (!isSender && !isRecipient) {
      throw new ForbiddenException('Non autorise');
    }
    let changed = false;
    if (isSender && message.deletedBySenderAt) {
      message.deletedBySenderAt = null;
      changed = true;
    }
    if (isRecipient && message.deletedByRecipientAt) {
      message.deletedByRecipientAt = null;
      changed = true;
    }
    if (!changed) {
      throw new BadRequestException('Message deja restaure');
    }
    await this.messages.save(message);
    return message;
  }

  async purge(
    userId: number,
    messageId: string,
  ): Promise<PrivateMessageRecord> {
    if (
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof messageId !== 'string' ||
      messageId.length > 128
    ) {
      throw new BadRequestException('Message invalide');
    }
    const message = await this.messages.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    const isSender = message.sender.id === userId;
    const isRecipient = message.recipient.id === userId;
    if (!isSender && !isRecipient) {
      throw new ForbiddenException('Non autorise');
    }
    if (isSender && !message.deletedBySenderAt) {
      throw new BadRequestException('Message pas dans la corbeille');
    }
    if (isRecipient && !message.deletedByRecipientAt) {
      throw new BadRequestException('Message pas dans la corbeille');
    }
    await this.messages.remove(message.messageId);
    return message;
  }

  async markRead(userId: number, messageId: string): Promise<void> {
    const id = typeof messageId === 'string' ? messageId.trim() : '';
    if (!id || id.length > 128 || !Number.isSafeInteger(userId) || userId <= 0)
      return;

    const message = await this.messages.findByMessageId(id);
    if (!message) {
      throw new NotFoundException('Message introuvable');
    }
    if (message.recipient?.id !== userId) {
      throw new ForbiddenException('Non autorise');
    }
    if (message.deletedByRecipientAt) {
      return;
    }
    if (message.readByRecipientAt) {
      return;
    }
    message.readByRecipientAt = businessMsToDate(this.clock.now());
    await this.messages.save(message);
  }

  async lookupUser(username: string): Promise<MessageUser | null> {
    const normalized =
      typeof username === 'string' ? username.trim().slice(0, 255) : '';
    if (!normalized) {
      return null;
    }
    return this.users.findByUsername(normalized);
  }

  private async ensureUser(id: number): Promise<MessageUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private clampLimit(limit: number): number {
    if (limit === Number.POSITIVE_INFINITY) return 500;
    if (!Number.isSafeInteger(limit)) {
      return PrivateMessagingService.DEFAULT_HISTORY_LIMIT;
    }
    return Math.max(
      1,
      Math.min(500, limit || PrivateMessagingService.DEFAULT_HISTORY_LIMIT),
    );
  }

  private generateMessageId(): string {
    if (crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
    return crypto.randomBytes(8).toString('hex');
  }
}
