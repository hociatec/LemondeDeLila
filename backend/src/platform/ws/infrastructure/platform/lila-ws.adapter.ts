import { WsAdapter } from '@nestjs/platform-ws';
import type { INestApplicationContext } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { ApplicationShutdownService } from '../../../lifecycle/public-api';
import {
  readEnvironment,
  readEnvironmentBoolean,
} from '../../../config/public-api';
import type { VerifyClientCallbackSync } from 'ws';
import { isAllowedWsOrigin } from './ws-origin-policy';

type BaseCreateOptions = Parameters<WsAdapter['create']>[1];
type BaseCreateReturn = ReturnType<WsAdapter['create']>;

type LilaWsOptions = BaseCreateOptions & {
  namespace?: string;
  server?: Parameters<WsAdapter['create']>[1] extends { server?: infer S }
    ? S
    : unknown;
  path?: string;
  perMessageDeflate?: boolean;
  maxPayload?: number;
};

const DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1024;

export class LilaWsAdapter extends WsAdapter {
  private readonly servers = new Set<WebSocketServer>();

  constructor(
    app?: INestApplicationContext | object,
    private readonly shutdown = new ApplicationShutdownService(),
  ) {
    super(app);
  }

  override create(port: number, options?: LilaWsOptions): BaseCreateReturn {
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
      throw new RangeError('Invalid WebSocket port');
    }
    const configuredPayload = options?.maxPayload ?? DEFAULT_MAX_PAYLOAD_BYTES;
    const maxPayload = Number.isSafeInteger(configuredPayload)
      ? Math.min(Math.max(configuredPayload, 1_024), 1_048_576)
      : DEFAULT_MAX_PAYLOAD_BYTES;
    const verifyClient: VerifyClientCallbackSync = ({ req }) =>
      !this.shutdown.isDraining &&
      isAllowedWsOrigin(
        req.headers.origin,
        readEnvironment('CORS_ORIGINS'),
        readEnvironment('NODE_ENV', 'development') === 'production',
      );
    const merged: BaseCreateOptions = {
      ...(options ?? {}),
      perMessageDeflate:
        options?.perMessageDeflate ??
        readEnvironmentBoolean('WS_PERMESSAGE_DEFLATE', true),
      maxPayload,
      verifyClient,
    };
    const server: unknown = super.create(port, merged);
    if (!isWebSocketServer(server))
      throw new Error('Expected WebSocket server');
    this.servers.add(server);
    return server;
  }

  async closeConnections(): Promise<void> {
    const sockets = [...this.servers].flatMap((server) => [...server.clients]);
    await Promise.all(
      sockets.map(
        (socket) =>
          new Promise<void>((resolve) => {
            if (socket.readyState === WebSocket.CLOSED) {
              resolve();
              return;
            }
            const timeout = setTimeout(() => socket.terminate(), 1_000);
            socket.once('close', () => {
              clearTimeout(timeout);
              resolve();
            });
            try {
              socket.close(1001, 'Server shutdown');
            } catch {
              socket.terminate();
            }
          }),
      ),
    );
  }
}

// Nest can load its own compatible ws package instance; constructor identity
// is not a contract across package installations.
function isWebSocketServer(value: unknown): value is WebSocketServer {
  return (
    !!value &&
    typeof value === 'object' &&
    'clients' in value &&
    !!value.clients &&
    typeof value.clients === 'object' &&
    Symbol.iterator in value.clients &&
    typeof value.clients[Symbol.iterator] === 'function' &&
    'close' in value &&
    typeof value.close === 'function' &&
    'on' in value &&
    typeof value.on === 'function'
  );
}
