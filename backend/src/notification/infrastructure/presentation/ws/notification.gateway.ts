import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { NotificationWsConnectionService } from './notification-ws-connection.service';

@WebSocketGateway({ path: '/ws/notify' })
export class NotificationGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  constructor(private readonly connection: NotificationWsConnectionService) {}

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    await this.connection.handleConnection(client, args);
  }

  handleDisconnect(client: WebSocket) {
    this.connection.handleDisconnect(client);
  }
}
