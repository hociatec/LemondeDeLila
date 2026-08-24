import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { PresenceWsConnectionService } from './presence-ws-connection.service';

@WebSocketGateway({
  path: '/presence',
})
export class PresenceGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  constructor(private readonly connection: PresenceWsConnectionService) {}

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    await this.connection.handleConnection(client, args);
  }

  handleDisconnect(client: WebSocket) {
    this.connection.handleDisconnect(client);
  }
}
