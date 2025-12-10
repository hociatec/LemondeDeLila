import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import { PresenceService } from '../services/presence.service';
import { WsAuthPayload } from '../../common/interfaces/ws-auth-payload';

@WebSocketGateway({
  path: '/presence',
})
export class PresenceGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly jwtSecret: string;
  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private readonly presence: PresenceService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET doit être défini pour le WebSocket de présence.');
    }
    this.jwtSecret = secret;
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const payload = this.resolveAuth(client, args);
    if (!payload || !payload.id || !payload.username) {
      client.close(4001, 'auth required');
      return;
    }
    this.presence.register(client, payload);
    client.on('message', (raw) => this.handleIncoming(client, raw));
    client.on('error', () => client.close());
    await this.presence.sendHistory(client);
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
    this.logger.log(`WS message reçu (${typeof raw}) de ${session.user.username}`);
    await this.presence.handleChatSend(session, raw);
  }

  private resolveAuth(client: WebSocket, args: any[]): WsAuthPayload | null {
    const request: any = (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const token =
      extractBearer((client as any).handshakeHeaders) ||
      extractBearer(request?.headers) ||
      extractQueryToken((client as any).url || request?.url);
    if (!token) {
      return null;
    }
    try {
      return jwt.verify(token, this.jwtSecret) as WsAuthPayload;
    } catch (err) {
      this.logger.warn(`Token WS invalide: ${(err as Error).message}`);
      // on refuse explicitement la connexion pour informer le client
      throw err;
    }
  }
}

function extractBearer(headers: any): string | null {
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

function extractQueryToken(urlCandidate?: string): string | null {
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
