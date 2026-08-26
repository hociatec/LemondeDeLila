import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { WsAuthPayload } from '../../../common/interfaces/public-api';
import { getErrorMessage } from '../../../common/utils/public-api';
import type { PresenceChatHistory } from '../models/presence-chat-history.model';
import {
  PRESENCE_CHAT_PORT,
  type PresenceChatPort,
} from '../ports/presence-chat.port';
import {
  PRESENCE_USER_REPOSITORY,
  type PresenceUserRepository,
} from '../ports/presence-user.repository';

export type PresenceChatBanPayload = {
  message: string;
  reason: string | null;
  until: string | null;
};

export type PresenceChatCommandResult =
  | { kind: 'message-posted'; message: Record<string, unknown> }
  | { kind: 'message-updated'; message: Record<string, unknown> }
  | { kind: 'message-deleted'; messageId: string }
  | { kind: 'denied'; payload: PresenceChatBanPayload }
  | { kind: 'error'; message: string }
  | { kind: 'noop' };

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
    @Inject(PRESENCE_CHAT_PORT)
    private readonly chat: PresenceChatPort,
    @Inject(PRESENCE_USER_REPOSITORY)
    private readonly users: PresenceUserRepository,
  ) {}

  async getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    const cached = this.chatBanCache.get(userId);
    if (cached && Date.now() - cached.at < this.chatBanCacheTtlMs) {
      return { until: cached.until, reason: cached.reason };
    }

    const user = await this.users.findChatBanByUserId(userId);
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

  buildChatHistory(): Promise<PresenceChatHistory> {
    return this.chat.getHistory();
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
      const message = await this.chat.recordMessage({
        userId: user.id,
        username: user.username,
        text,
      });
      return {
        kind: 'message-posted',
        message,
      };
    } catch (err) {
      this.logger.warn(
        `Message tchat refusé pour ${user.username}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Erreur tchat.'),
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
      const normalized = await this.chat.editOwnMessage(
        user.id,
        messageId,
        text,
      );
      return {
        kind: 'message-updated',
        message: normalized,
      };
    } catch (err) {
      this.logger.warn(
        `Echec édition tchat pour ${user.username}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Modification impossible.'),
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
        kind: 'message-deleted',
        messageId,
      };
    } catch (err) {
      this.logger.warn(
        `Echec suppression tchat pour ${user.username}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Suppression impossible.'),
      };
    }
  }
}
