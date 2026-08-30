import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { getErrorDetails } from '@shared/utils/public-api';
import type {
  PresenceClient,
  PresenceIncomingPayload,
} from '../contracts/presence-client.model';
import {
  PresenceChatCommandResult,
  PresenceChatService,
} from './presence-chat.service';
import {
  normalizePresenceContext,
  parsePresenceRoomId,
} from './presence-state.utils';

type MessageCallbacks = {
  broadcastChat: (event: Record<string, unknown>) => void;
  presenceChanged: () => void;
};

@Injectable()
export class PresenceClientMessageService {
  private readonly logger = new Logger(PresenceClientMessageService.name);

  constructor(private readonly chat: PresenceChatService) {}

  async handle(
    from: PresenceClient,
    raw: unknown,
    callbacks: MessageCallbacks,
  ): Promise<void> {
    const payload = this.decode(raw);
    if (!payload) {
      return;
    }
    if (payload.type === 'presence-activity') {
      from.lastInteractionAt =
        typeof payload.at === 'number' && Number.isFinite(payload.at)
          ? payload.at
          : Date.now();
      return;
    }
    from.lastInteractionAt = Date.now();
    if (payload.type === 'chat-send') {
      await this.sendChat(from, payload, callbacks.broadcastChat);
    } else if (payload.type === 'chat-edit') {
      await this.editChat(from, payload, callbacks.broadcastChat);
    } else if (payload.type === 'chat-delete') {
      await this.deleteChat(from, payload, callbacks.broadcastChat);
    } else {
      this.updatePresenceContext(from, payload);
      callbacks.presenceChanged();
    }
  }

  async sendHistory(to: WebSocket): Promise<void> {
    try {
      const history = await this.chat.buildChatHistory();
      to.send(
        JSON.stringify({
          type: 'chat-history',
          editWindowSeconds: history.editWindowSeconds,
          messages: history.messages,
        }),
      );
    } catch (error) {
      this.logger.error('Echec envoi historique chat', getErrorDetails(error));
      to.close();
    }
  }

  isChatBannedNow(userId: number): Promise<boolean> {
    return this.chat.isChatBannedNow(userId);
  }

  getChatBanInfo(
    userId: number,
  ): Promise<{ until: Date | null; reason: string | null } | null> {
    return this.chat.getChatBanInfo(userId);
  }

  private decode(raw: unknown): PresenceIncomingPayload | null {
    let text: string;
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      text = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return null;
    }
    if (text.length > 16_384) {
      this.logger.warn('Message WS trop volumineux, rejeté');
      return null;
    }
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }
      const record = value as Record<string, unknown>;
      return typeof record.type === 'string'
        ? (record as PresenceIncomingPayload)
        : null;
    } catch {
      return null;
    }
  }

  private async sendChat(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-send' }>,
    broadcast: MessageCallbacks['broadcastChat'],
  ): Promise<void> {
    const text = typeof payload.text === 'string' ? payload.text : '';
    const result = await this.chat.sendMessage(from.user, text);
    this.handleChatResult(from.socket, result, broadcast);
  }

  private async editChat(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-edit' }>,
    broadcast: MessageCallbacks['broadcastChat'],
  ): Promise<void> {
    const messageId = this.messageIdOf(payload.messageId);
    if (!messageId) {
      return;
    }
    const text = typeof payload.text === 'string' ? payload.text : '';
    const result = await this.chat.editMessage(from.user, messageId, text);
    this.handleChatResult(from.socket, result, broadcast);
  }

  private async deleteChat(
    from: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'chat-delete' }>,
    broadcast: MessageCallbacks['broadcastChat'],
  ): Promise<void> {
    const messageId = this.messageIdOf(payload.messageId);
    if (!messageId) {
      return;
    }
    const result = await this.chat.deleteMessage(from.user, messageId);
    this.handleChatResult(from.socket, result, broadcast);
  }

  private handleChatResult(
    socket: WebSocket,
    result: PresenceChatCommandResult,
    broadcast: MessageCallbacks['broadcastChat'],
  ): void {
    const event = this.chatEventOf(result);
    if (event) {
      broadcast(event);
      return;
    }
    if (result.kind === 'denied') {
      this.safeSend(socket, { type: 'error', payload: result.payload });
      try {
        socket.close(4403, 'chat banned');
      } catch {
        /* ignore */
      }
    } else if (result.kind === 'error') {
      this.safeSend(socket, {
        type: 'error',
        payload: { message: result.message },
      });
    }
  }

  private chatEventOf(
    result: PresenceChatCommandResult,
  ): Record<string, unknown> | null {
    if (result.kind === 'message-posted') {
      return { type: 'chat-message', payload: result.message };
    }
    if (result.kind === 'message-updated') {
      return { type: 'chat-message.updated', payload: result.message };
    }
    if (result.kind === 'message-deleted') {
      return {
        type: 'chat-message.deleted',
        payload: { id: result.messageId },
      };
    }
    return null;
  }

  private updatePresenceContext(
    client: PresenceClient,
    payload: Extract<PresenceIncomingPayload, { type: 'presence-context' }>,
  ): void {
    const raw =
      typeof payload.context === 'string' ? payload.context.toLowerCase() : '';
    client.context = normalizePresenceContext(raw);
    client.contextLocked = true;
    if (client.context !== 'table') {
      client.roomHint = null;
      return;
    }
    const roomId = parsePresenceRoomId(payload.roomId);
    if (roomId === null) {
      client.roomHint = null;
      return;
    }
    const roomName =
      typeof payload.roomName === 'string' && payload.roomName.trim()
        ? payload.roomName.trim()
        : null;
    client.roomHint = { id: roomId, name: roomName };
  }

  private messageIdOf(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private safeSend(socket: WebSocket, payload: unknown): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }
}
