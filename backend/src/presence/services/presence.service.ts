import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatService } from '../../chat/services/chat.service';
import { ChatValidator } from '../../chat/services/chat.validator';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { In, IsNull, Repository } from 'typeorm';

export type PresenceConnectionContext = 'home' | 'chat';
type PresenceActivity = 'home' | 'chat' | 'table';

type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
  context: PresenceConnectionContext;
};

type PresenceBroadcastPlayer = {
  id: number;
  username: string;
  currentRoom: { id: number; name: string } | null;
  activity: PresenceActivity;
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
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  register(
    socket: WebSocket,
    user: WsAuthPayload,
    context: PresenceConnectionContext = 'home',
  ) {
    this.clients.set(socket, { socket, user, context });
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
    const playersByUser = new Map<number, PresenceBroadcastPlayer>();
    for (const { user, context } of this.clients.values()) {
      const existing = playersByUser.get(user.id);
      const activity: PresenceActivity = context === 'chat' ? 'chat' : 'home';
      if (existing) {
        if (activity === 'chat' && existing.activity !== 'table') {
          existing.activity = 'chat';
        }
        continue; // déjà ajouté, on évite les doublons si plusieurs connexions pour le même utilisateur
      }
      playersByUser.set(user.id, {
        id: user.id,
        username: user.username,
        currentRoom: null,
        activity,
      });
    }
    this.attachRooms(playersByUser)
      .then(() => {
        const payload = {
          type: 'presence-update',
          players: Array.from(playersByUser.values()),
        };
        this.broadcast(payload);
      })
      .catch(() => {
        const payload = {
          type: 'presence-update',
          players: Array.from(playersByUser.values()),
        };
        this.broadcast(payload);
      });
  }

  private async attachRooms(
    playersByUser: Map<number, PresenceBroadcastPlayer>,
  ) {
    const userIds = Array.from(playersByUser.keys());
    if (userIds.length === 0) {
      return;
    }
    const participants = await this.participants.find({
      where: {
        leftAt: IsNull(),
        user: { id: In(userIds) } as any,
      },
      relations: ['room', 'user'],
      order: { joinedAt: 'DESC' },
    });
    for (const p of participants) {
      const entry = playersByUser.get(p.user.id);
      if (!entry || !p.room) {
        continue;
      }
      // Ne prendre que la room la plus récente (première dans l'ordre DESC)
      if (entry.currentRoom === null) {
        entry.currentRoom = { id: p.room.id, name: p.room.name };
        entry.activity = 'table';
      }
    }
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
