import { Injectable } from '@nestjs/common';
import { WsApiHubService } from '../../common/ws/ws-api-hub.service';

type Subscription = { gameType: string | null };

@Injectable()
export class PublicRoomDirectoryService {
  private readonly subscriptions = new Map<string, Subscription>();
  private pending: { roomId: number | null; reason: string | null } | null =
    null;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushDelayMs = 250;

  constructor(private readonly hub: WsApiHubService) {}

  subscribe(connectionId: string, gameType?: string | null) {
    if (!connectionId || !connectionId.trim()) return;
    const normalized = typeof gameType === 'string' ? gameType.trim() : '';
    this.subscriptions.set(connectionId, { gameType: normalized || null });
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

    const connectionIds = Array.from(this.subscriptions.keys());
    if (connectionIds.length === 0) return;

    const message = {
      type: 'rooms.public.refresh',
      requestId: 'push',
      payload: payload ?? { roomId: null, reason: null },
    };

    for (const connectionId of connectionIds) {
      // For now we ignore per-gameType filtering and let clients request with filters.
      const ok = this.hub.send(connectionId, message);
      if (!ok) {
        this.subscriptions.delete(connectionId);
      }
    }
  }
}
