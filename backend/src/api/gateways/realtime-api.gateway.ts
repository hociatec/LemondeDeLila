import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { AuthMessageHandler } from '../handlers/auth-message.handler';
import { CatalogMessageHandler } from '../handlers/catalog-message.handler';
import { MessagingMessageHandler } from '../handlers/messaging-message.handler';
import { UserMessageHandler } from '../handlers/user-message.handler';
import { GameMessageHandler } from '../handlers/game-message.handler';
import { SESSION_STORE, type SessionStateStore } from '../services/session-store.interface';

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

type RouteHandler = (session: ClientSession, payload: any) => Promise<{ type: string; payload: any } | null>;

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
  private readonly routes: Map<string, RouteHandler>;

  constructor(
    auth: AuthMessageHandler,
    catalog: CatalogMessageHandler,
    messaging: MessagingMessageHandler,
    users: UserMessageHandler,
    game: GameMessageHandler,
    @Inject(SESSION_STORE) private readonly sessionStore: SessionStateStore,
  ) {
    this.routes = new Map<string, RouteHandler>([
      ['auth.register', (_, payload) => auth.register(payload)],
      ['auth.login', (_, payload) => auth.login(payload)],
      ['catalog.all', () => catalog.all()],
      ['catalog.categories', () => catalog.categories()],
      ['catalog.categoryGames', (_, payload) => catalog.categoryGames(payload)],
      ['catalog.games', () => catalog.games()],
      ['messaging.conversation', (session, payload) => messaging.conversation(session, payload)],
      ['messaging.messages', (session, payload) => messaging.messages(session, payload)],
      ['messaging.send', (session, payload) => messaging.send(session, payload)],
      ['messaging.delete', (session, payload) => messaging.delete(session, payload)],
      ['messaging.restore', (session, payload) => messaging.restore(session, payload)],
      ['messaging.search', (_, payload) => messaging.search(payload)],
      ['users.list', () => users.list()],
      ['users.get', (_, payload) => users.get(payload)],
      ['game.rules', (session, payload) => game.rules(session, payload)],
      ['game.modules', (session) => game.modules(session)],
      ['game.state', (session, payload) => game.state(session, payload)],
      ['game.actions.available', (session, payload) => game.availableActions(session, payload)],
      ['game.actions.apply', (session, payload) => game.applyActions(session, payload)],
      ['game.bot.play', (session, payload) => game.botPlay(session, payload)],
    ]);
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const connectionId = randomUUID();
    const token = this.extractToken(client, args);
    const session: ClientSession = { socket: client, user: null, connectionId };
    if (token) {
      try {
        session.user = this.verify(token);
      } catch (err) {
        this.logger.warn(`Connexion WS sans auth valide: ${(err as Error).message}`);
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
      const handler = this.routes.get(type);
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

  private sendError(client: WebSocket, message: string, context?: string, requestId?: string) {
    this.safeSend(client, {
      type: 'error',
      requestId,
      context,
      payload: { message },
    });
  }

  private extractToken(client: WebSocket, args: any[]): string | null {
    const request: any = (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    const headerToken = this.extractBearer((client as any).handshakeHeaders) || this.extractBearer(request?.headers);
    if (headerToken) {
      return headerToken;
    }
    return this.extractQueryToken(urlCandidate);
  }

  private extractBearer(headers: any): string | null {
    if (!headers) return null;
    const authHeader = headers.authorization || headers.Authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }
    return null;
  }

  private extractQueryToken(urlCandidate?: string): string | null {
    if (!urlCandidate || typeof urlCandidate !== 'string') {
      return null;
    }
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private verify(token: string): WsAuthPayload {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    try {
      return jwt.verify(token, secret) as WsAuthPayload;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
      return (err as any).message;
    }
    return 'Erreur inconnue';
  }
}
