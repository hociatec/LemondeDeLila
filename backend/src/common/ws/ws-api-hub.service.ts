import { Injectable, Logger } from '@nestjs/common';
import type { WebSocket } from 'ws';

@Injectable()
export class WsApiHubService {
  private readonly logger = new Logger(WsApiHubService.name);
  private readonly socketsByConnectionId = new Map<string, WebSocket>();

  register(connectionId: string, socket: WebSocket) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.set(connectionId, socket);
  }

  unregister(connectionId: string) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.delete(connectionId);
  }

  send(connectionId: string, message: any): boolean {
    const socket = this.socketsByConnectionId.get(connectionId);
    if (!socket) return false;
    if ((socket as any).readyState !== 1 /* OPEN */) {
      this.socketsByConnectionId.delete(connectionId);
      return false;
    }
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      this.logger.debug(
        `Echec envoi WS push connectionId=${connectionId}`,
        err as Error,
      );
      this.socketsByConnectionId.delete(connectionId);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      return false;
    }
  }
}
