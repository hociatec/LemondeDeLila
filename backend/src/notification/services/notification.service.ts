import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly socketsByUserId = new Map<number, Set<WebSocket>>();

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

  notifyUser(userId: number, type: string, payload: any) {
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
