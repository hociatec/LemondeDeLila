import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { WsApiHubService } from '../../../../../platform/ws/public-api';

type Subscription = {
  gameType: string | null;
};

@Injectable()
export class RoomLobbyRefreshService implements OnModuleDestroy {
  private static readonly MAX_SUBSCRIPTIONS = 10_000;
  private readonly subscriptions = new Map<string, Subscription>();
  private pending: { roomId: number | null; reason: string | null } | null =
    null;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushDelayMs = 250;

  constructor(private readonly hub: WsApiHubService) {}

  onModuleDestroy(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pending = null;
    this.subscriptions.clear();
  }

  subscribe(connectionId: string, gameType?: string | null) {
    const normalizedConnectionId =
      typeof connectionId === 'string' ? connectionId.trim() : '';
    if (!normalizedConnectionId || normalizedConnectionId.length > 128) return;
    if (
      !this.subscriptions.has(normalizedConnectionId) &&
      this.subscriptions.size >= RoomLobbyRefreshService.MAX_SUBSCRIPTIONS
    ) {
      return;
    }
    const normalizedGameType =
      typeof gameType === 'string' ? gameType.trim().slice(0, 96) : '';
    this.subscriptions.set(normalizedConnectionId, {
      gameType: normalizedGameType || null,
    });
  }

  unsubscribe(connectionId: string) {
    const normalizedConnectionId =
      typeof connectionId === 'string' ? connectionId.trim() : '';
    if (!normalizedConnectionId || normalizedConnectionId.length > 128) return;
    this.subscriptions.delete(normalizedConnectionId);
  }

  notifyRefresh(roomId?: number | null, reason?: string | null) {
    // Coalesce bursts (join/leave/bot/etc.) into a single refresh push.
    const next = {
      roomId:
        typeof roomId === 'number' &&
        Number.isSafeInteger(roomId) &&
        roomId > 0
          ? roomId
          : null,
      reason:
        typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 128)
          : null,
    };
    this.pending = this.pending ?? next;
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushDelayMs);
    }
  }

  private flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const payload = this.pending;
    this.pending = null;

    const entries = Array.from(this.subscriptions.entries());
    if (entries.length === 0) return;

    const body = payload ?? { roomId: null, reason: null };
    for (const [connectionId] of entries) {
      const message = {
        type: 'room.lobby.refresh',
        requestId: 'push',
        payload: body,
      };
      // For now we ignore per-gameType filtering and let clients request with filters.
      const ok = this.hub.send(connectionId, message);
      if (!ok) {
        this.subscriptions.delete(connectionId);
      }
    }
  }
}
/** Room application capability boundary. */
