import { Inject, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import {
  SESSION_STORE,
  type SessionStateStore,
} from '../../common/session/session-store.interface';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';

type IncomingMessage = {
  type?: string;
  payload?: any;
  requestId?: string;
};

type ClientSession = {
  socket: WebSocket;
  user: WsAuthPayload | null;
  connectionId: string;
};

@WebSocketGateway({
  path: '/ws/api',
})
export class RealtimeApiGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, ClientSession>();
  private readonly logger = new Logger(RealtimeApiGateway.name);

  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly auth: WsJwtAuthService,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStateStore,
  ) {}

  async handleConnection(client: WebSocket, ...args: any[]) {
    const connectionId = randomUUID();
    const token = this.auth.extractToken(client, args);
    const session: ClientSession = { socket: client, user: null, connectionId };
    if (token) {
      try {
        session.user = this.auth.verify(token);
      } catch (err) {
        this.logger.warn(
          `Connexion WS sans auth valide: ${(err as Error).message}`,
        );
      }
    }
    this.clients.set(client, session);
    await this.sessionStore.save(connectionId, {
      userId: session.user?.id ?? null,
      username: session.user?.username,
      roles: session.user?.roles ?? null,
    });
    client.on('message', (raw) => this.handleIncoming(client, raw));
    client.on('error', () => client.close());
  }

  handleDisconnect(client: WebSocket) {
    const session = this.clients.get(client);
    this.clients.delete(client);
    if (session) {
      this.sessionStore.delete(session.connectionId).catch(() => {});
    }
  }

  private async handleIncoming(client: WebSocket, raw: any) {
    const session = this.clients.get(client);
    if (!session) {
      client.close();
      return;
    }
    const decoded = this.decode(raw);
    if (!decoded?.type) {
      return;
    }
    const { type, payload, requestId } = decoded;
    try {
      const handler = this.registry.get(type);
      if (!handler) {
        this.sendError(client, 'Type de message inconnu', type, requestId);
        return;
      }
      const response = await handler(session, payload);
      if (response) {
        this.safeSend(client, { requestId, ...response });
      }
    } catch (err) {
      this.sendError(client, this.formatError(err), type, requestId);
    }
  }

  private decode(raw: any): IncomingMessage | null {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      text = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return null;
    }
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text) as IncomingMessage;
    } catch {
      return null;
    }
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.warn('Echec envoi WS', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private sendError(
    client: WebSocket,
    message: string,
    context?: string,
    requestId?: string,
  ) {
    this.safeSend(client, {
      type: 'error',
      requestId,
      context,
      payload: { message },
    });
  }

  private formatError(err: unknown): string {
    if (
      err &&
      typeof err === 'object' &&
      'message' in err &&
      typeof (err as any).message === 'string'
    ) {
      return (err as any).message;
    }
    return 'Erreur inconnue';
  }
}
