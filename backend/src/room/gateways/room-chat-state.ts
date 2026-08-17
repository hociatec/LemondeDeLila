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
  private readonly roomChatLimit = 120;
  private readonly chatCooldownMs = 350;
  private readonly chatMaxLength = 300;

  clearRoom(roomId: number): void {
    this.roomChat.delete(roomId);
  }

  getHistory(roomId: number): RoomChatMessage[] {
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
  ): RoomChatMessage {
    const state = this.getRoomChatState(roomId);
    const chatMessage: RoomChatMessage = {
      seq: state.nextSeq++,
      userId: message.userId,
      username: message.username,
      message: message.message,
      createdAt: new Date().toISOString(),
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
    this.roomChat.set(roomId, created);
    return created;
  }
}
