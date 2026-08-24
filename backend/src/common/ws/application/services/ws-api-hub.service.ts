import { Injectable, Logger } from '@nestjs/common';

type WsSocketLike = {
  readyState: number;
  send(data: string, cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
};

@Injectable()
export class WsApiHubService {
  private readonly logger = new Logger(WsApiHubService.name);
  private readonly socketsByConnectionId = new Map<string, WsSocketLike>();

  register(connectionId: string, socket: WsSocketLike) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.set(connectionId, socket);
  }

  unregister(connectionId: string) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.delete(connectionId);
  }

  send(connectionId: string, message: unknown): boolean {
    const socket = this.socketsByConnectionId.get(connectionId);
    if (!socket) return false;
    if (socket.readyState !== 1 /* OPEN */) {
      this.socketsByConnectionId.delete(connectionId);
      return false;
    }
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : undefined;
      this.logger.debug(
        `Echec envoi WS push connectionId=${connectionId}`,
        error,
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
