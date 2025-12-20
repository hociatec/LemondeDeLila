import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { NotificationService } from '../services/notification.service';

type ClientMeta = { userId: number; socket: WebSocket };

@WebSocketGateway({ path: '/ws/notify' })
export class NotificationGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly clients = new Map<WebSocket, ClientMeta>();

  constructor(
    private readonly auth: WsJwtAuthService,
    private readonly notifications: NotificationService,
  ) {}

  async handleConnection(client: WebSocket, ...args: any[]) {
    const token = this.auth.extractToken(client, args);
    const user = this.auth.tryVerify(token);
    if (!user?.id) {
      client.close(4001, 'auth required');
      return;
    }
    this.clients.set(client, { userId: user.id, socket: client });
    this.notifications.register(user.id, client);
    client.on('error', () => client.close());
    this.safeSend(client, {
      type: 'notify.connected',
      payload: { userId: user.id },
    });
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
    this.clients.delete(client);
    if (meta) {
      this.notifications.unregister(meta.userId, client);
    }
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.debug('Echec envoi WS notify', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
