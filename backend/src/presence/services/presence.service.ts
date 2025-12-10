import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { ChatService } from '../../chat/services/chat.service';
import { ChatValidator } from '../../chat/services/chat.validator';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';

type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
};

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly clients = new Map<WebSocket, PresenceClient>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pingIntervalMs = 30_000;
  private readonly pingTimeoutMs = 10_000;

  constructor(
    private readonly chat: ChatService,
    private readonly validator: ChatValidator,
  ) {}

  register(socket: WebSocket, user: WsAuthPayload) {
    this.clients.set(socket, { socket, user });
    this.ensureHeartbeat();
  }

  unregister(socket: WebSocket) {
    this.clients.delete(socket);
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  async handleChatSend(from: PresenceClient, raw: any) {
    let textPayload: string;
    if (typeof raw === 'string') {
      textPayload = raw;
    } else if (Buffer.isBuffer(raw)) {
      textPayload = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      textPayload = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return;
    }
    if (textPayload.length > 16_384) {
      this.logger.warn('Message WS trop volumineux, rejeté');
      return;
    }
    let payload: any = null;
    try {
      payload = JSON.parse(textPayload);
    } catch {
      return;
    }
    if (!payload || payload.type !== 'chat-send') {
      return;
    }
    const text = typeof payload.text === 'string' ? payload.text : '';
    let sanitized: string;
    try {
      this.logger.log(`Chat-send reçu de ${from.user.username} (#${from.user.id})`);
      sanitized = this.validator.validate(text);
    } catch (err) {
      this.logger.warn(`Message chat invalide pour ${from.user.username}: ${(err as Error)?.message ?? 'inconnu'}`);
      return;
    }
    const message = await this.chat.recordMessage(from.user.id, sanitized);
    const normalized = this.chat.normalize(message);
    this.broadcast(normalized);
  }

  async sendHistory(to: WebSocket) {
    try {
      const history = await this.chat.getRecentMessages();
      const payload = {
        type: 'chat-history',
        messages: this.chat.normalizeMany(history),
      };
      to.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.error('Echec envoi historique chat', err as Error);
      to.close();
    }
  }

  broadcastPresence() {
    const playersByUser = new Map<number, { id: number; username: string; rooms: any[] }>();
    for (const { user } of this.clients.values()) {
      const existing = playersByUser.get(user.id);
      if (existing) {
        continue; // déjà ajouté, on évite les doublons si plusieurs connexions pour le même utilisateur
      }
      playersByUser.set(user.id, {
        id: user.id,
        username: user.username,
        rooms: [],
      });
    }
    const players = Array.from(playersByUser.values());
    const payload = {
      type: 'presence-update',
      players,
    };
    this.broadcast(payload);
  }

  private broadcast(payload: Record<string, unknown>) {
    const encoded = JSON.stringify(payload);
    for (const { socket } of this.clients.values()) {
      try {
        socket.send(encoded);
      } catch (err) {
        this.logger.warn('Envoi WS échoué', err as Error);
        this.unregister(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }
  }

  findClient(socket: WebSocket): PresenceClient | undefined {
    return this.clients.get(socket);
  }

  private ensureHeartbeat() {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), this.pingIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private runHeartbeat() {
    const now = Date.now();
    for (const socket of Array.from(this.clients.keys())) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.unregister(socket);
        continue;
      }
      const pongTimeout = setTimeout(() => {
        this.unregister(socket);
        try {
          socket.terminate?.();
        } catch {
          socket.close();
        }
      }, this.pingTimeoutMs);
      try {
        socket.ping();
        socket.once('pong', () => clearTimeout(pongTimeout));
      } catch {
        clearTimeout(pongTimeout);
        this.unregister(socket);
        try {
          socket.terminate?.();
        } catch {
          socket.close();
        }
      }
    }
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }
}
