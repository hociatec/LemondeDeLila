import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatService } from '../../chat/services/chat.service';
import { ChatValidator } from '../../chat/services/chat.validator';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { In, IsNull, Repository } from 'typeorm';

export type PresenceConnectionContext = 'home' | 'chat' | 'table';
type PresenceActivity = 'home' | 'chat' | 'table';

type PresenceClient = {
  socket: WebSocket;
  user: WsAuthPayload;
  context: PresenceConnectionContext;
  contextLocked: boolean;
  roomHint: { id: number; name?: string | null } | null;
};

type PresenceBroadcastPlayer = {
  id: number;
  username: string;
  currentRoom: { id: number; name: string } | null;
  activity: PresenceActivity;
  contextLocked: boolean;
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
    this.clients.set(socket, { socket, user, context, contextLocked: false, roomHint: null });
    this.ensureHeartbeat();
  }

  unregister(socket: WebSocket) {
    this.clients.delete(socket);
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  async handleClientPayload(from: PresenceClient, raw: any) {
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
    if (!payload || typeof payload.type !== 'string') {
      return;
    }
    if (payload.type === 'chat-send') {
      await this.handleChatSend(from, payload);
      return;
    }
    if (payload.type === 'presence-context') {
      this.handlePresenceContext(from, payload);
      this.broadcastPresence();
    }
  }

  private async handleChatSend(from: PresenceClient, payload: any) {
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

  private handlePresenceContext(client: PresenceClient, payload: any) {
    const raw = typeof payload.context === 'string' ? payload.context.toLowerCase() : '';
    let context: PresenceConnectionContext = 'home';
    if (raw === 'chat') {
      context = 'chat';
    } else if (raw === 'table') {
      context = 'table';
    }
    client.context = context;
    client.contextLocked = true;
    if (context === 'table') {
      const roomId = this.parseRoomId(payload.roomId);
      if (roomId !== null) {
        let name: string | null = null;
        if (typeof payload.roomName === 'string') {
          const trimmed = payload.roomName.trim();
          name = trimmed.length > 0 ? trimmed : null;
        }
        client.roomHint = { id: roomId, name };
      } else {
        client.roomHint = null;
      }
    } else {
      client.roomHint = null;
    }
  }

  private parseRoomId(value: any): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
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
    for (const client of this.clients.values()) {
      const { user, context, roomHint, contextLocked } = client;
      const activity: PresenceActivity = context ?? 'home';
      const candidate: PresenceBroadcastPlayer = {
        id: user.id,
        username: user.username,
        currentRoom: roomHint
          ? { id: roomHint.id, name: roomHint.name ?? `Table #${roomHint.id}` }
          : null,
        activity,
        contextLocked,
      };
      const existing = playersByUser.get(user.id);
      if (!existing) {
        playersByUser.set(user.id, candidate);
        continue;
      }
      const currentScore = this.scoreActivity(existing.activity);
      const candidateScore = this.scoreActivity(candidate.activity);
      if (candidateScore < currentScore) {
        playersByUser.set(user.id, candidate);
        continue;
      }
      if (candidateScore === currentScore) {
        existing.contextLocked = existing.contextLocked || candidate.contextLocked;
        if (!existing.currentRoom && candidate.currentRoom) {
          existing.currentRoom = candidate.currentRoom;
        }
      }
    }
    this.attachRooms(playersByUser)
      .then(() => {
        const payload = {
          type: 'presence-update',
          players: Array.from(playersByUser.values()).map(({ contextLocked, ...rest }) => rest),
        };
        this.broadcast(payload);
      })
      .catch(() => {
        const payload = {
          type: 'presence-update',
          players: Array.from(playersByUser.values()).map(({ contextLocked, ...rest }) => rest),
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
      if (entry.activity === 'chat') {
        continue;
      }
      if (entry.contextLocked && entry.activity !== 'table') {
        continue;
      }
      if (entry.currentRoom === null) {
        entry.currentRoom = { id: p.room.id, name: p.room.name };
      }
      if (!entry.contextLocked) {
        entry.activity = 'table';
      }
    }
  }

  private scoreActivity(activity: PresenceActivity): number {
    if (activity === 'table') {
      return 0;
    }
    if (activity === 'chat') {
      return 1;
    }
    return 2;
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
