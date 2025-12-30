import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import {
  PresenceConnectionContext,
  PresenceService,
} from '../services/presence.service';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';

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
    private readonly auth: WsJwtAuthService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET doit être défini pour le WebSocket de présence.',
      );
    }
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const payload = this.resolveAuth(client, args);
    if (!payload || !payload.id || !payload.username) {
      client.close(4001, 'auth required');
      return;
    }
    const context = this.resolveContext(client, args);
    if (context === 'chat') {
      const ban = await this.presence.getChatBanInfo(payload.id);
      if (ban?.until && ban.until.getTime() > Date.now()) {
        try {
          client.send(
            JSON.stringify({
              type: 'error',
              payload: {
                message: 'Accès au tchat refusé.',
                reason: ban.reason ?? null,
                until: ban.until ? ban.until.toISOString() : null,
              },
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
    // tracer la reception brute pour debug
    this.logger.log(
      `WS message reçu (${typeof raw}) de ${session.user.username}`,
    );
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
