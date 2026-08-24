import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { RealtimeApiConnectionService } from './realtime-api-connection.service';

@WebSocketGateway({
  path: '/ws/game',
})
export class RealtimeGameGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  constructor(private readonly connection: RealtimeApiConnectionService) {}

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    await this.connection.handleConnection(client, args, 'game');
  }

  handleDisconnect(client: WebSocket) {
    this.connection.handleDisconnect(client);
  }
}
