import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatValidator } from './chat.validator';
import { IsNull } from 'typeorm';

type BroadcastUser = {
  id: number;
  username: string;
};

@Injectable()
export class ChatService {
  private static readonly DEFAULT_HISTORY_LIMIT = 200;
  private static readonly CACHE_LIMIT = 2000;
  private historyCache: Array<Record<string, unknown>> | null = null;

  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    private readonly validator: ChatValidator,
  ) {}

  async recordMessageForBroadcast(
    user: BroadcastUser,
    text: string,
  ): Promise<Record<string, unknown>> {
    const sanitized = this.validator.validate(text);
    const messageId = this.generateMessageId();
    const createdAt = new Date();

    const message = this.messages.create({
      user: { id: user.id } as any,
      message: sanitized,
      messageId,
      createdAt,
    });

    // Évite un aller-retour DB (fetch user) : l'utilisateur vient du JWT.
    // Si la contrainte FK échoue, on ne diffuse pas.
    await this.messages.save(message);

    const normalized = {
      type: 'chat-message',
      id: messageId,
      text: sanitized,
      createdAt: createdAt.toISOString(),
      user: {
        id: user.id,
        username: user.username,
        avatar: null,
      },
    };

    this.appendToCache(normalized);
    return normalized;
  }

  async getRecentMessages(
    limit = ChatService.DEFAULT_HISTORY_LIMIT,
    since?: Date,
  ): Promise<ChatMessage[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.deletedAt IS NULL')
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), ChatService.CACHE_LIMIT));

    if (since) {
      qb.andWhere('m.createdAt >= :since', { since });
    }

    const rows = await qb.getMany();
    return rows.reverse(); // renvoyer dans l'ordre chronologique
  }

  async getRecentNormalizedMessages(
    limit = ChatService.DEFAULT_HISTORY_LIMIT,
  ): Promise<Array<Record<string, unknown>>> {
    await this.ensureHistoryCache();
    const safeLimit = Math.min(Math.max(limit, 1), ChatService.CACHE_LIMIT);
    return this.historyCache!.slice(-safeLimit);
  }

  normalize(message: ChatMessage): Record<string, unknown> {
    const created =
      message.createdAt instanceof Date ? message.createdAt : new Date();
    const createdIso = isFinite(created.getTime())
      ? created.toISOString()
      : new Date().toISOString();

    return {
      type: 'chat-message',
      id: message.messageId,
      text: message.message,
      createdAt: createdIso,
      user: {
        id: message.user?.id,
        username: message.user?.username,
        avatar: message.user?.avatar ?? null,
      },
    };
  }

  normalizeMany(messages: ChatMessage[]): Array<Record<string, unknown>> {
    return messages.map((m) => this.normalize(m));
  }

  async adminListMessages(
    limit = ChatService.DEFAULT_HISTORY_LIMIT,
    includeDeleted = false,
  ): Promise<ChatMessage[]> {
    const qb = this.messages
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .orderBy('m.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), ChatService.CACHE_LIMIT));

    // NOTE: on garde le paramètre includeDeleted pour compatibilité protocolaire,
    // mais côté produit la suppression est définitive (pas de corbeille).
    if (!includeDeleted) qb.where({ deletedAt: IsNull() });

    const rows = await qb.getMany();
    return rows.reverse();
  }

  async adminDeleteMessage(messageId: string): Promise<boolean> {
    const id = (messageId || '').trim();
    if (!id) return false;
    const res = await this.messages.delete({ messageId: id });
    if ((res.affected ?? 0) > 0) {
      this.removeFromCache(id);
    }
    return (res.affected ?? 0) > 0;
  }

  async adminClearAll(): Promise<number> {
    // Suppression définitive.
    const res = await this.messages
      .createQueryBuilder()
      .delete()
      .from(ChatMessage)
      .execute();
    if ((res.affected ?? 0) > 0) {
      this.historyCache = [];
    }
    return res.affected ?? 0;
  }

  private generateMessageId(): string {
    return randomBytes(8).toString('hex');
  }

  private async ensureHistoryCache(): Promise<void> {
    if (this.historyCache !== null) return;
    const rows = await this.getRecentMessages(ChatService.CACHE_LIMIT);
    this.historyCache = this.normalizeMany(rows);
  }

  private appendToCache(message: Record<string, unknown>): void {
    if (this.historyCache === null) {
      this.historyCache = [];
    }
    this.historyCache.push(message);
    if (this.historyCache.length > ChatService.CACHE_LIMIT) {
      this.historyCache.splice(0, this.historyCache.length - ChatService.CACHE_LIMIT);
    }
  }

  private removeFromCache(messageId: string): void {
    if (!this.historyCache) return;
    const idx = this.historyCache.findIndex((m) => (m as any)?.id === messageId);
    if (idx >= 0) this.historyCache.splice(idx, 1);
  }
}
