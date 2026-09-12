import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  WS_RUNTIME_CONFIG,
  type WsRuntimeConfig,
} from '../ports/ws-runtime-config.port';
import { stringifyExternalJson } from '../../../serialization/public-api';

type WsSocketLike = {
  readyState: number;
  bufferedAmount?: number;
  send(data: string, cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
  terminate?(): void;
};

const SHUTDOWN_SOCKET_GRACE_MS = 1_000;
const MAX_OUTBOUND_MESSAGE_BYTES = 1 * 1024 * 1024;

export type WsApiHubConnectionMeta = {
  scope?: string;
  roomId?: number | null;
  gameType?: string | null;
  userId?: number | null;
};

@Injectable()
export class WsApiHubService implements OnModuleDestroy {
  private readonly logger = new Logger(WsApiHubService.name);
  private readonly socketsByConnectionId = new Map<string, WsSocketLike>();
  private readonly metaByConnectionId = new Map<
    string,
    WsApiHubConnectionMeta
  >();

  constructor(
    @Inject(WS_RUNTIME_CONFIG) private readonly config: WsRuntimeConfig,
  ) {}

  onModuleDestroy(): void {
    const sockets = [...this.socketsByConnectionId.values()];
    for (const socket of sockets) {
      try {
        socket.close(1001, 'Server shutdown');
      } catch (error) {
        this.logger.debug(
          'Échec de fermeture WebSocket pendant le shutdown',
          error instanceof Error ? error : undefined,
        );
      }
    }
    this.socketsByConnectionId.clear();
    this.metaByConnectionId.clear();
    const termination = setTimeout(() => {
      for (const socket of sockets) {
        if (socket.readyState !== 3) socket.terminate?.();
      }
    }, SHUTDOWN_SOCKET_GRACE_MS);
    termination.unref();
  }

  register(
    connectionId: string,
    socket: WsSocketLike,
    meta: WsApiHubConnectionMeta = {},
  ) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.set(connectionId, socket);
    this.metaByConnectionId.set(connectionId, meta);
  }

  updateMeta(connectionId: string, meta: WsApiHubConnectionMeta) {
    if (!connectionId || !connectionId.trim()) return;
    const current = this.metaByConnectionId.get(connectionId) ?? {};
    this.metaByConnectionId.set(connectionId, {
      ...current,
      ...meta,
    });
  }

  unregister(connectionId: string) {
    if (!connectionId || !connectionId.trim()) return;
    this.socketsByConnectionId.delete(connectionId);
    this.metaByConnectionId.delete(connectionId);
  }

  listConnections(): Array<{
    connectionId: string;
    meta: WsApiHubConnectionMeta;
  }> {
    return Array.from(this.socketsByConnectionId.keys()).map(
      (connectionId) => ({
        connectionId,
        meta: this.metaByConnectionId.get(connectionId) ?? {},
      }),
    );
  }

  send(connectionId: string, message: unknown): boolean {
    const socket = this.socketsByConnectionId.get(connectionId);
    if (!socket) return false;
    if (socket.readyState !== 1 /* OPEN */) {
      this.unregister(connectionId);
      return false;
    }
    if ((socket.bufferedAmount ?? 0) > this.config.maxBufferedBytes) {
      this.logger.warn(
        JSON.stringify({
          event: 'ws.backpressure.disconnect',
          connectionId,
          bufferedBytes: socket.bufferedAmount,
          maxBufferedBytes: this.config.maxBufferedBytes,
        }),
      );
      this.unregister(connectionId);
      socket.close(1013, 'Client too slow');
      return false;
    }
    try {
      const serialized = stringifyExternalJson(message);
      if (Buffer.byteLength(serialized, 'utf8') > MAX_OUTBOUND_MESSAGE_BYTES) {
        this.logger.warn(
          `Message WS sortant trop volumineux connectionId=${connectionId}`,
        );
        this.unregister(connectionId);
        socket.close(1009, 'Message too large');
        return false;
      }
      socket.send(serialized);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : undefined;
      this.logger.debug(
        `Echec envoi WS push connectionId=${connectionId}`,
        error,
      );
      this.unregister(connectionId);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      return false;
    }
  }
}
