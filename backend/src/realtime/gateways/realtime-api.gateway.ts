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
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { WsApiHubService } from '../../common/ws/ws-api-hub.service';

type IncomingMessage = {
  type?: string;
  payload?: any;
  requestId?: string;
};

type ClientSession = {
  socket: WebSocket;
  user: WsAuthPayload | null;
  connectionId: string;
  clientVersion: string | null;
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
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly hub: WsApiHubService,
  ) {}

  async handleConnection(client: WebSocket, ...args: any[]) {
    const connectionId = randomUUID();
    const clientVersion = this.auth.extractClientVersion(client, args);
    const token = this.auth.extractToken(client, args);
    if (
      !this.wsTickets.validateIfTokenPresent(
        client,
        args,
        'api',
        Boolean(token),
      )
    ) {
      try {
        client.close(4403, 'ws ticket requis');
      } catch {
        /* ignore */
      }
      return;
    }
    const session: ClientSession = {
      socket: client,
      user: null,
      connectionId,
      clientVersion,
    };
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
    this.hub.register(connectionId, client);

    // IMPORTANT: attacher les handlers AVANT tout `await`.
    // Sinon, un client qui envoie un message immédiatement après le handshake (cas fréquent)
    // peut se faire "perdre" le premier message car aucun listener n'est encore abonné.
    client.on('message', (raw) => this.handleIncoming(client, raw));
    client.on('error', () => client.close());

    try {
      await this.sessionStore.save(connectionId, {
        userId: session.user?.id ?? null,
        username: session.user?.username,
        roles: session.user?.roles ?? null,
      });
    } catch (err) {
      // Ne pas bloquer la connexion WS si Redis est lent/indisponible : le client peut tout de même utiliser l'API WS.
      this.logger.warn(
        `Impossible de persister la session WS (connectionId=${connectionId}): ${(err as Error).message}`,
      );
    }
  }

  handleDisconnect(client: WebSocket) {
    const session = this.clients.get(client);
    this.clients.delete(client);
    if (session) {
      this.sessionStore.delete(session.connectionId).catch(() => {});
      this.hub.unregister(session.connectionId);
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
      this.logger.debug(
        `Message WS ignoré (invalide ou sans type) connectionId=${session.connectionId}`,
      );
      return;
    }
    const { type, payload, requestId } = decoded;

    const minRequired = await this.clientUpdates.getMinRequiredVersion();
    if (
      minRequired &&
      (!session.clientVersion ||
        isVersionLower(session.clientVersion, minRequired) === true)
    ) {
      this.sendError(
        client,
        `Mise à jour requise (version minimale: ${minRequired}).`,
        type,
        requestId,
      );
      try {
        client.close(4406, 'update required');
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      const handler = this.registry.get(type);
      if (!handler) {
        this.logger.warn(
          `Type WS inconnu: ${type} (requestId=${requestId ?? 'n/a'})`,
        );
        this.sendError(client, 'Type de message inconnu', type, requestId);
        return;
      }

      const start = Date.now();
      this.logger.debug(
        `WS -> backend type=${type} requestId=${requestId ?? 'n/a'} userId=${session.user?.id ?? 'anon'} connectionId=${session.connectionId}`,
      );
      const response = await handler(session, payload);
      const elapsedMs = Date.now() - start;
      if (elapsedMs >= 2000) {
        this.logger.warn(
          `WS handler lent: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`,
        );
      } else {
        this.logger.debug(
          `WS handler ok: ${type} (${elapsedMs}ms) requestId=${requestId ?? 'n/a'}`,
        );
      }
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
