import { WebSocket } from 'ws';

export type RoomChatMessage = {
  seq: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
};

type RoomChatState = {
  nextSeq: number;
  messages: RoomChatMessage[];
};

export class RoomChatStore {
  private readonly lastChatSentAt = new WeakMap<WebSocket, number>();
  private readonly roomChat = new Map<number, RoomChatState>();

  clear(): void {
    this.roomChat.clear();
  }
  private readonly roomChatLimit = 120;
  private readonly maxRooms = 10_000;
  private readonly chatCooldownMs = 350;
  private readonly chatMaxLength = 300;

  clearRoom(roomId: number): void {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return;
    this.roomChat.delete(roomId);
  }

  getHistory(roomId: number): RoomChatMessage[] {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return [];
    return this.getRoomChatState(roomId).messages;
  }

  tryConsumeCooldown(client: WebSocket, now: number): boolean {
    const lastAt = this.lastChatSentAt.get(client) ?? 0;
    if (now - lastAt < this.chatCooldownMs) {
      return false;
    }
    this.lastChatSentAt.set(client, now);
    return true;
  }

  normalizeMessage(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.replace(/\r?\n/g, ' ').trim();
    if (!trimmed) return '';
    if (trimmed.length <= this.chatMaxLength) return trimmed;
    return trimmed.slice(0, this.chatMaxLength).trim();
  }

  appendMessage(
    roomId: number,
    message: Pick<RoomChatMessage, 'userId' | 'username' | 'message'>,
    createdAt: string,
  ): RoomChatMessage {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new RangeError('Invalid room id');
    }
    const state = this.getRoomChatState(roomId);
    const chatMessage: RoomChatMessage = {
      seq: state.nextSeq++ >>> 0,
      userId: message.userId,
      username: String(message.username ?? '').slice(0, 255),
      message: message.message,
      createdAt,
    };
    state.messages.push(chatMessage);
    while (state.messages.length > this.roomChatLimit) {
      state.messages.shift();
    }
    return chatMessage;
  }

  private getRoomChatState(roomId: number): RoomChatState {
    const existing = this.roomChat.get(roomId);
    if (existing) return existing;
    const created: RoomChatState = { nextSeq: 1, messages: [] };
    if (this.roomChat.size >= this.maxRooms) {
      const oldest = this.roomChat.keys().next().value;
      if (typeof oldest === 'number') this.roomChat.delete(oldest);
    }
    this.roomChat.set(roomId, created);
    return created;
  }
}
