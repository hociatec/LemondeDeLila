import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivateMessage } from '../entities/private-message.entity';
import { User } from '../../user/entities/user.entity';
import { MessageValidatorService } from './message-validator.service';
import { SendMessageDto } from '../dto/send-message.dto';

export type MessageUserDto = { id: number; username: string };
export type MessageDto = {
  id: string;
  sender: MessageUserDto;
  recipient: MessageUserDto;
  text: string;
  subject: string | null;
  createdAt: string;
  direction: 'sent' | 'received';
  deletedAt: string | null;
};

@Injectable()
export class MessagingService {
  private static readonly DEFAULT_HISTORY_LIMIT = 100;

  constructor(
    @InjectRepository(PrivateMessage)
    private readonly messages: Repository<PrivateMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly validator: MessageValidatorService,
  ) {}

  async send(senderId: number, payload: SendMessageDto): Promise<MessageDto> {
    const sender = await this.ensureUser(senderId);
    if (sender.id === payload.recipientId) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous envoyer un message',
      );
    }
    const recipient = await this.users.findOne({
      where: { id: payload.recipientId },
    });
    if (!recipient) {
      throw new NotFoundException('Destinataire introuvable');
    }

    const sanitized = this.validator.validate(payload.text);
    const subject = this.validator.validateSubject(payload.subject);
    const message = this.messages.create({
      sender,
      recipient,
      messageId: this.generateMessageId(),
      message: sanitized,
      subject,
    });
    await this.messages.save(message);
    return this.toDto(message, sender.id);
  }

  async conversation(
    currentId: number,
    otherUserId: number,
    limit = MessagingService.DEFAULT_HISTORY_LIMIT,
  ) {
    if (currentId === otherUserId) {
      return [];
    }
    const other = await this.users.findOne({ where: { id: otherUserId } });
    if (!other) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    const clamped = this.clampLimit(limit);
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where(
        '(m.sender_id = :current AND m.recipient_id = :other AND m.deleted_by_sender_at IS NULL) OR (m.sender_id = :other AND m.recipient_id = :current AND m.deleted_by_recipient_at IS NULL)',
      )
      .setParameters({ current: currentId, other: otherUserId })
      .orderBy('m.created_at', 'ASC')
      .limit(clamped)
      .getMany();
    return items.map((m) => this.toDto(m, currentId));
  }

  async inbox(userId: number, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
    const clamped = this.clampLimit(limit);
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where('m.recipient_id = :user AND m.deleted_by_recipient_at IS NULL', {
        user: userId,
      })
      .orderBy('m.created_at', 'DESC')
      .limit(clamped)
      .getMany();
    return items.map((m) => this.toDto(m, userId));
  }

  async outbox(userId: number, limit = MessagingService.DEFAULT_HISTORY_LIMIT) {
    const clamped = this.clampLimit(limit);
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .where('m.sender_id = :user AND m.deleted_by_sender_at IS NULL', {
        user: userId,
      })
      .orderBy('m.created_at', 'DESC')
      .limit(clamped)
      .getMany();
    return items.map((m) => this.toDto(m, userId));
  }

  async deleted(
    userId: number,
    limit = MessagingService.DEFAULT_HISTORY_LIMIT,
  ) {
    const clamped = this.clampLimit(limit);
    const items = await this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .leftJoinAndSelect('m.recipient', 'recipient')
      .addSelect(
        `CASE WHEN m.deleted_by_sender_at IS NOT NULL THEN m.deleted_by_sender_at ELSE m.deleted_by_recipient_at END`,
        'deletionDate',
      )
      .where(
        '(m.sender_id = :user AND m.deleted_by_sender_at IS NOT NULL) OR (m.recipient_id = :user AND m.deleted_by_recipient_at IS NOT NULL)',
        { user: userId },
      )
      .orderBy('deletionDate', 'DESC')
      .limit(clamped)
      .getMany();
    return items.map((m) => this.toDto(m, userId));
  }

  async delete(userId: number, messageId: string): Promise<MessageDto> {
    const message = await this.messages.findOne({
      where: { messageId },
      relations: ['sender', 'recipient'],
    });
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
      message.deletedBySenderAt = new Date();
      changed = true;
    }
    if (isRecipient && !message.deletedByRecipientAt) {
      message.deletedByRecipientAt = new Date();
      changed = true;
    }
    if (changed) {
      await this.messages.save(message);
    }
    return this.toDto(message, userId);
  }

  async restore(userId: number, messageId: string): Promise<MessageDto> {
    const message = await this.messages.findOne({
      where: { messageId },
      relations: ['sender', 'recipient'],
    });
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
    return this.toDto(message, userId);
  }

  async lookupUser(username: string): Promise<MessageUserDto | null> {
    const normalized = (username ?? '').trim();
    if (!normalized) {
      return null;
    }
    const user = await this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.username'])
      .where('LOWER(u.username) = LOWER(:u)', { u: normalized })
      .getOne();
    if (!user) return null;
    return { id: user.id, username: user.username };
  }

  private async ensureUser(id: number): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      select: ['id', 'username'],
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  private toDto(message: PrivateMessage, viewerId: number): MessageDto {
    const direction = message.sender.id === viewerId ? 'sent' : 'received';
    const deletedAt =
      direction === 'sent'
        ? (message.deletedBySenderAt ?? null)
        : (message.deletedByRecipientAt ?? null);
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
    };
  }

  private clampLimit(limit: number): number {
    return Math.max(
      1,
      Math.min(500, limit || MessagingService.DEFAULT_HISTORY_LIMIT),
    );
  }

  private generateMessageId(): string {
    if (crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    }
    return Math.random().toString(16).slice(2, 18);
  }
}
