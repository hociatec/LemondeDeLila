import { OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { RoomGatewayDispatcherService } from './room-gateway-dispatcher.service';

@WebSocketGateway({ path: '/ws' })
export class RoomGateway
  implements
    OnModuleInit,
    OnGatewayConnection<WebSocket>,
    OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  constructor(private readonly dispatcher: RoomGatewayDispatcherService) {}

  onModuleInit(): void {
    this.dispatcher.initialize(this.server);
  }

  handleConnection(client: WebSocket, ...args: unknown[]): Promise<void> {
    return this.dispatcher.handleConnection(client, args);
  }

  handleDisconnect(client: WebSocket): Promise<void> {
    return this.dispatcher.handleDisconnect(client);
  }

  @SubscribeMessage('message')
  handleMessage(client: WebSocket, raw: unknown): Promise<void> {
    return this.dispatcher.handleMessage(client, raw);
  }
}
