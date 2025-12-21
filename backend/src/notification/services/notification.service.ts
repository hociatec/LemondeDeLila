import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import {
  NotificationTransport,
  NotificationEvent,
} from './notification-transport';

@Injectable()
export class NotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
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
    if (!this.socketsByUserId.has(userId)) {
      this.socketsByUserId.set(userId, new Set());
    }
    this.socketsByUserId.get(userId)!.add(socket);
  }

  unregister(userId: number, socket: WebSocket) {
    const set = this.socketsByUserId.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      this.socketsByUserId.delete(userId);
    }
  }

  async notifyUser(userId: number, type: string, payload: any) {
    await this.transport.publish({
      userId,
      type,
      payload,
      origin: this.instanceId,
    });
    this.dispatchToLocal(userId, type, payload);
  }

  private handleExternalEvent(event: NotificationEvent) {
    if (event.origin === this.instanceId) {
      return;
    }
    this.dispatchToLocal(event.userId, event.type, event.payload);
  }

  private dispatchToLocal(userId: number, type: string, payload: any) {
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
          err as Error,
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
