import { Injectable, Logger } from '@nestjs/common';
import { userBanState, userBanStatus } from '../../../user/public-api';
import { Inject } from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../shared/interfaces/public-api';
import { WsAuthPayload } from '../../../../shared/interfaces/public-api';
import { getErrorMessage } from '../../../../shared/utils/public-api';
import { operationalSettings } from '../../../../platform/config/public-api';
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
  private static readonly MAX_CHAT_BAN_CACHE_ENTRIES = 10_000;
  private static readonly DENIED_MESSAGE = 'Accès au tchat refusé.';

  constructor(
    @Inject(PRESENCE_CHAT_PORT)
    private readonly chat: PresenceChatPort,
    @Inject(PRESENCE_USER_REPOSITORY)
    private readonly users: PresenceUserRepository,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    return this.loadChatBanInfo(userId, true);
  }

  private async loadChatBanInfo(
    userId: number,
    allowCached: boolean,
  ): Promise<{ until: Date | null; reason: string | null }> {
    if (allowCached) {
      const cached = this.chatBanCache.get(userId);
      if (
        cached &&
        this.clock.now() - cached.at <
          operationalSettings.presenceChatBanCacheTtlMs
      ) {
        return { until: cached.until, reason: cached.reason };
      }
    }

    const user = await this.users.findChatBanByUserId(userId);
    const until = user?.chatBannedUntil ?? null;
    const reason = user?.chatBanReason ?? null;
    this.chatBanCache.set(userId, { at: this.clock.now(), until, reason });
    if (
      this.chatBanCache.size > PresenceChatService.MAX_CHAT_BAN_CACHE_ENTRIES
    ) {
      const oldest = this.chatBanCache.keys().next().value;
      if (typeof oldest === 'number') this.chatBanCache.delete(oldest);
    }
    return { until, reason };
  }

  async isChatBannedNow(userId: number): Promise<boolean> {
    const ban = await this.getChatBanInfo(userId);
    const status = userBanStatus(ban?.until, this.clock.now());
    return status === 'active' || status === 'invalid';
  }

  async getActiveChatBanPayload(
    userId: number,
  ): Promise<PresenceChatBanPayload | null> {
    const ban = await this.getChatBanInfo(userId);
    return this.toActiveChatBanPayload(ban);
  }

  private async getAuthoritativeChatBanPayload(
    userId: number,
  ): Promise<PresenceChatBanPayload | null> {
    const ban = await this.loadChatBanInfo(userId, false);
    return this.toActiveChatBanPayload(ban);
  }

  private toActiveChatBanPayload(
    ban: {
      until: Date | null;
      reason: string | null;
    } | null,
  ): PresenceChatBanPayload | null {
    if (!ban) return null;
    const state = userBanState(ban?.until, this.clock.now());
    if (state.status === 'none' || state.status === 'expired') {
      return null;
    }
    return {
      message: PresenceChatService.DENIED_MESSAGE,
      reason: ban.reason ?? null,
      until: state.status === 'active' ? state.until.toISOString() : null,
    };
  }

  buildChatHistory(): Promise<PresenceChatHistory> {
    return this.chat.getHistory();
  }

  async sendMessage(
    user: WsAuthPayload,
    text: string,
  ): Promise<PresenceChatCommandResult> {
    if (
      typeof text !== 'string' ||
      text.trim().length === 0 ||
      text.length > 2_000
    ) {
      return { kind: 'error', message: 'Message invalide.' };
    }
    try {
      const denied = await this.getAuthoritativeChatBanPayload(user.id);
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
        `Message tchat refusé pour \${user.id}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Erreur tchat.').slice(0, 512),
      };
    }
  }

  async editMessage(
    user: WsAuthPayload,
    messageId: string,
    text: string,
  ): Promise<PresenceChatCommandResult> {
    if (!messageId || messageId.length > 128) {
      return { kind: 'noop' };
    }
    try {
      const denied = await this.getAuthoritativeChatBanPayload(user.id);
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
        `Echec édition tchat pour \${user.id}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Modification impossible.').slice(0, 512),
      };
    }
  }

  async deleteMessage(
    user: WsAuthPayload,
    messageId: string,
  ): Promise<PresenceChatCommandResult> {
    if (!messageId || messageId.length > 128) {
      return { kind: 'noop' };
    }
    try {
      const denied = await this.getAuthoritativeChatBanPayload(user.id);
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
        `Echec suppression tchat pour \${user.id}: ${getErrorMessage(
          err,
          'inconnu',
        )}`,
      );
      return {
        kind: 'error',
        message: getErrorMessage(err, 'Suppression impossible.').slice(0, 512),
      };
    }
  }
}
