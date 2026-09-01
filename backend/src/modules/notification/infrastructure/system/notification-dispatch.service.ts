import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { NotificationDispatcher } from '../../application/ports/notification-dispatcher.port';
import {
  NotificationTransport,
  NotificationEvent,
} from '../transport/notification-transport';
import { getErrorDetails } from '../../../../shared/utils/public-api';

@Injectable()
export class NotificationDispatchService
  implements NotificationDispatcher, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatchService.name);
  private readonly socketsByUserId = new Map<number, Set<WebSocket>>();
  private readonly instanceId = randomUUID();

  constructor(private readonly transport: NotificationTransport) {
    this.transport
      .subscribe((event) => this.handleExternalEvent(event))
      .catch((err) =>
        this.logger.error('Impossible de souscrire aux notifications', err),
      );
  }

  async onModuleDestroy(): Promise<void> {
    await this.transport.disconnect();
  }

  register(userId: number, socket: WebSocket) {
    let sockets = this.socketsByUserId.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.socketsByUserId.set(userId, sockets);
    }
    sockets.add(socket);
  }

  unregister(userId: number, socket: WebSocket) {
    const set = this.socketsByUserId.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      this.socketsByUserId.delete(userId);
    }
  }

  async notifyUser(userId: number, type: string, payload: unknown) {
    try {
      await this.transport.publish({
        userId,
        type,
        payload,
        origin: this.instanceId,
      });
    } catch (err) {
      // Best-effort: do not break API calls if Redis/pubsub is down.
      this.logger.warn(
        `Echec publication notification userId=${userId} type=${type}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    this.dispatchToLocal(userId, type, payload);
  }

  // Broadcast to all connected users.
  // Implementation detail: userId=0 is treated as a "global" event and dispatched to every socket.
  async notifyAll(type: string, payload: unknown) {
    try {
      await this.transport.publish({
        userId: 0,
        type,
        payload,
        origin: this.instanceId,
      });
    } catch (err) {
      // Best-effort: do not break API calls if Redis/pubsub is down.
      this.logger.warn(
        `Echec publication notification broadcast type=${type}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    this.dispatchToAllLocal(type, payload);
  }

  disconnectAll(reason?: string, eventType?: string) {
    const payload =
      typeof reason === 'string' && reason.trim().length > 0
        ? { reason: reason.trim() }
        : null;
    const message =
      payload != null && eventType
        ? JSON.stringify({ type: eventType, payload })
        : null;

    void this.transport
      .publish({
        userId: 0,
        type: eventType || 'system.server.disconnect',
        payload,
        origin: this.instanceId,
        disconnect: true,
      })
      .catch((err) =>
        this.logger.warn(
          'Echec publication de la déconnexion globale',
          err instanceof Error ? err.stack : String(err),
        ),
      );

    for (const [userId, sockets] of Array.from(
      this.socketsByUserId.entries(),
    )) {
      for (const socket of Array.from(sockets)) {
        if (socket.readyState === WebSocket.OPEN && message) {
          try {
            socket.send(message);
          } catch {
            // ignore
          }
        }
        try {
          socket.close(1000, reason ?? 'maintenance');
        } catch {
          // ignore
        }
      }
      sockets.clear();
      this.socketsByUserId.delete(userId);
    }
  }

  private handleExternalEvent(event: NotificationEvent) {
    if (event.origin === this.instanceId) {
      return;
    }
    if (event.disconnect) {
      const reason =
        event.payload &&
        typeof event.payload === 'object' &&
        'reason' in event.payload &&
        typeof (event.payload as { reason?: unknown }).reason === 'string'
          ? (event.payload as { reason: string }).reason
          : 'maintenance';
      this.disconnectAllLocal(reason, event.type);
      return;
    }
    if (event.userId === 0) {
      this.dispatchToAllLocal(event.type, event.payload);
      return;
    }
    this.dispatchToLocal(event.userId, event.type, event.payload);
  }

  private disconnectAllLocal(reason: string, eventType: string): void {
    const message = JSON.stringify({ type: eventType, payload: { reason } });
    for (const sockets of this.socketsByUserId.values()) {
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(message);
          } catch {
            // ignore
          }
        }
        try {
          socket.close(1000, reason);
        } catch {
          // ignore
        }
      }
    }
    this.socketsByUserId.clear();
  }

  private dispatchToLocal(userId: number, type: string, payload: unknown) {
    const targets = this.socketsByUserId.get(userId);
    if (!targets || targets.size === 0) return;
    const message = JSON.stringify({ type, payload });
    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WebSocket.OPEN) {
        targets.delete(socket);
        continue;
      }
      try {
        socket.send(message);
      } catch (err) {
        this.logger.debug(
          `Echec envoi notification userId=${userId}`,
          getErrorDetails(err),
        );
        targets.delete(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }
    if (targets.size === 0) {
      this.socketsByUserId.delete(userId);
    }
  }

  private dispatchToAllLocal(type: string, payload: unknown) {
    const message = JSON.stringify({ type, payload });
    for (const [userId, targets] of Array.from(
      this.socketsByUserId.entries(),
    )) {
      for (const socket of Array.from(targets)) {
        if (socket.readyState !== WebSocket.OPEN) {
          targets.delete(socket);
          continue;
        }
        try {
          socket.send(message);
        } catch (err) {
          this.logger.debug(
            `Echec envoi notification userId=${userId}`,
            getErrorDetails(err),
          );
          targets.delete(socket);
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        }
      }
      if (targets.size === 0) {
        this.socketsByUserId.delete(userId);
      }
    }
  }
}
