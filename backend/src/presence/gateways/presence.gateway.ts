import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import {
  PresenceConnectionContext,
  PresenceService,
} from '../services/presence.service';
import { PresenceChatService } from '../services/presence-chat.service';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';

@WebSocketGateway({
  path: '/presence',
})
export class PresenceGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private readonly presence: PresenceService,
    private readonly chat: PresenceChatService,
    private readonly auth: WsJwtAuthService,
    private readonly wsTickets: WsTicketAuthService,
  ) {
    // Auth JWT is handled by WsJwtAuthService (RS256/HS256 depending on configuration).
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    let payload: WsAuthPayload | null = null;
    try
    {
      payload = this.resolveAuth(client, args);
    }
    catch
    {
      try
      {
        client.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'Le token d\'authentification est invalide.' },
          }),
        );
      }
      catch
      {
        /* ignore */
      }
      client.close(4001, 'invalid ws token');
      return;
    }

    if (!payload || !payload.id || !payload.username) {
      try
      {
        client.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'Authentification requise pour ouvrir le tchat.' },
          }),
        );
      }
      catch
      {
        /* ignore */
      }
      client.close(4001, 'auth required');
      return;
    }
    if (!this.wsTickets.validate(client, args, 'presence')) {
      try
      {
        client.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'Le ticket WebSocket est requis pour se connecter.' },
          }),
        );
      }
      catch
      {
        /* ignore */
      }
      client.close(4403, 'ws ticket requis');
      return;
    }
    const context = this.resolveContext(client, args);
    if (context === 'chat') {
      const banned = await this.chat.getActiveChatBanPayload(payload.id);
      if (banned) {
        try {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: banned,
            }),
          );
        } catch {
          /* ignore */
        }
        client.close(4403, 'chat banned');
        return;
      }
    }
    this.presence.register(client, payload, context);
    client.on('message', (raw) => this.handleIncoming(client, raw));
    client.on('error', () => client.close());
    if (context === 'chat') {
      await this.presence.sendHistory(client);
    }
    this.presence.broadcastPresence();
  }

  handleDisconnect(client: WebSocket) {
    this.presence.unregister(client);
    this.presence.broadcastPresence();
  }

  private async handleIncoming(client: WebSocket, raw: any) {
    const session = this.presence.findClient(client);
    if (!session) {
      client.close();
      return;
    }
    // IMPORTANT: ne pas logger chaque message en production (latence + I/O disque).
    await this.presence.handleClientPayload(session, raw);
  }

  private resolveAuth(client: WebSocket, args: any[]): WsAuthPayload | null {
    const token = this.auth.extractToken(client, args);
    if (!token) {
      return null;
    }
    try {
      return this.auth.verify(token);
    } catch (err) {
      this.logger.warn(`Token WS invalide: ${(err as Error).message}`);
      // on refuse explicitement la connexion pour informer le client
      throw err;
    }
  }

  private resolveContext(
    client: WebSocket,
    args: any[],
  ): PresenceConnectionContext {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      const raw = (url.searchParams.get('context') || '').toLowerCase();
      if (raw === 'chat') {
        return 'chat';
      }
    } catch {
      /* ignore */
    }
    return 'home';
  }
}
