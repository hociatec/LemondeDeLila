import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { WsApiHubService } from '../../../../../platform/ws/public-api';

type Subscription = {
  gameType: string | null;
  refreshType: 'legacy' | 'lobby';
};

@Injectable()
export class RoomLobbyRefreshService implements OnModuleDestroy {
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

  subscribe(
    connectionId: string,
    gameType?: string | null,
    refreshType: 'legacy' | 'lobby' = 'legacy',
  ) {
    if (!connectionId || !connectionId.trim()) return;
    const normalized = typeof gameType === 'string' ? gameType.trim() : '';
    this.subscriptions.set(connectionId, {
      gameType: normalized || null,
      refreshType,
    });
  }

  unsubscribe(connectionId: string) {
    if (!connectionId || !connectionId.trim()) return;
    this.subscriptions.delete(connectionId);
  }

  notifyRefresh(roomId?: number | null, reason?: string | null) {
    // Coalesce bursts (join/leave/bot/etc.) into a single refresh push.
    const next = {
      roomId:
        typeof roomId === 'number' && Number.isFinite(roomId) ? roomId : null,
      reason:
        typeof reason === 'string' && reason.trim() ? reason.trim() : null,
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
    for (const [connectionId, sub] of entries) {
      const type =
        sub?.refreshType === 'lobby'
          ? 'room.lobby.refresh'
          : 'rooms.public.refresh';
      const message = { type, requestId: 'push', payload: body };
      // For now we ignore per-gameType filtering and let clients request with filters.
      const ok = this.hub.send(connectionId, message);
      if (!ok) {
        this.subscriptions.delete(connectionId);
      }
    }
  }
}
/** Room application capability boundary. */
