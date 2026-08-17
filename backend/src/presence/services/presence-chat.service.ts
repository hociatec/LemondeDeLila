import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from '../../chat/services/chat.service';
import { ChatSettingsService } from '../../chat/services/chat-settings.service';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { User } from '../../user/entities/user.entity';

export type PresenceChatBanPayload = {
  message: string;
  reason: string | null;
  until: string | null;
};

export type PresenceChatCommandResult =
  | { kind: 'ok'; event: Record<string, unknown> }
  | { kind: 'denied'; payload: PresenceChatBanPayload }
  | { kind: 'error'; message: string }
  | { kind: 'noop' };

export type PresenceChatHistoryPayload = {
  type: 'chat-history';
  editWindowSeconds: number;
  messages: Array<Record<string, unknown>>;
};

@Injectable()
export class PresenceChatService {
  private readonly logger = new Logger(PresenceChatService.name);
  private readonly chatBanCache = new Map<
    number,
    { at: number; until: Date | null; reason: string | null }
  >();
  private readonly chatBanCacheTtlMs = 10_000;
  private static readonly DENIED_MESSAGE = 'Accès au tchat refusé.';

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly chat: ChatService,
    private readonly chatSettings: ChatSettingsService,
  ) {}

  async getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    const cached = this.chatBanCache.get(userId);
    if (cached && Date.now() - cached.at < this.chatBanCacheTtlMs) {
      return { until: cached.until, reason: cached.reason };
    }

    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'chatBannedUntil', 'chatBanReason'] as any,
    });
    const until = user?.chatBannedUntil ?? null;
    const reason = user?.chatBanReason ?? null;
    this.chatBanCache.set(userId, { at: Date.now(), until, reason });
    return { until, reason };
  }

  async isChatBannedNow(userId: number): Promise<boolean> {
    const ban = await this.getChatBanInfo(userId);
    return !!(ban?.until && ban.until.getTime() > Date.now());
  }

  async getActiveChatBanPayload(
    userId: number,
  ): Promise<PresenceChatBanPayload | null> {
    const ban = await this.getChatBanInfo(userId);
    if (!ban?.until || ban.until.getTime() <= Date.now()) {
      return null;
    }
    return {
      message: PresenceChatService.DENIED_MESSAGE,
      reason: ban.reason ?? null,
      until: ban.until.toISOString(),
    };
  }

  async buildChatHistoryPayload(): Promise<PresenceChatHistoryPayload> {
    const limit = this.chatSettings.getChatHistoryLimit();
    const editWindowSeconds = this.chatSettings.getEditWindowSeconds();
    const messages = await this.chat.getRecentNormalizedMessages(limit);
    return {
      type: 'chat-history',
      editWindowSeconds,
      messages,
    };
  }

  async sendMessage(
    user: WsAuthPayload,
    text: string,
  ): Promise<PresenceChatCommandResult> {
    try {
      const denied = await this.getActiveChatBanPayload(user.id);
      if (denied) {
        return { kind: 'denied', payload: denied };
      }
      const event = await this.chat.recordMessageForBroadcast(
        { id: user.id, username: user.username },
        text,
      );
      return { kind: 'ok', event };
    } catch (err) {
      this.logger.warn(
        `Message tchat refusé pour ${user.username}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
      return {
        kind: 'error',
        message: (err as Error)?.message ?? 'Erreur tchat.',
      };
    }
  }

  async editMessage(
    user: WsAuthPayload,
    messageId: string,
    text: string,
  ): Promise<PresenceChatCommandResult> {
    if (!messageId) {
      return { kind: 'noop' };
    }
    try {
      const denied = await this.getActiveChatBanPayload(user.id);
      if (denied) {
        return { kind: 'denied', payload: denied };
      }
      const normalized = await this.chat.editOwnMessage(user.id, messageId, text);
      return {
        kind: 'ok',
        event: { type: 'chat-message.updated', payload: normalized },
      };
    } catch (err) {
      this.logger.warn(
        `Echec édition tchat pour ${user.username}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
      return {
        kind: 'error',
        message: (err as Error)?.message ?? 'Modification impossible.',
      };
    }
  }

  async deleteMessage(
    user: WsAuthPayload,
    messageId: string,
  ): Promise<PresenceChatCommandResult> {
    if (!messageId) {
      return { kind: 'noop' };
    }
    try {
      const denied = await this.getActiveChatBanPayload(user.id);
      if (denied) {
        return { kind: 'denied', payload: denied };
      }
      const ok = await this.chat.deleteOwnMessage(user.id, messageId);
      if (!ok) {
        return { kind: 'noop' };
      }
      return {
        kind: 'ok',
        event: { type: 'chat-message.deleted', payload: { id: messageId } },
      };
    } catch (err) {
      this.logger.warn(
        `Echec suppression tchat pour ${user.username}: ${
          (err as Error)?.message ?? 'inconnu'
        }`,
      );
      return {
        kind: 'error',
        message: (err as Error)?.message ?? 'Suppression impossible.',
      };
    }
  }
}
