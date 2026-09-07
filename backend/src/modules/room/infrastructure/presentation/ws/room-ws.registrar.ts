import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../../platform/realtime/public-api';
import { RoomLobbyWsHandler } from './room-lobby-ws.handler';

@Injectable()
export class RoomWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: RoomLobbyWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('room.lobby.list', (session, payload) =>
      this.handler.listPublic(session, payload),
    );
    this.registry.register('room.lobby.join', (session, payload) =>
      this.handler.joinPublic(session, payload),
    );
    this.registry.register('room.lobby.leave', (session, payload) =>
      this.handler.leavePublic(session, payload),
    );
    this.registry.register('room.lobby.spectate', (session, payload) =>
      this.handler.spectatePublic(session, payload),
    );
    this.registry.register('room.lobby.subscribe', (session, payload) =>
      this.handler.subscribePublic(session, payload),
    );
    this.registry.register('room.lobby.unsubscribe', (session) =>
      this.handler.unsubscribePublic(session),
    );
    this.registry.register('room.lobby.invite.send', (session, payload) =>
      this.handler.inviteSend(session, payload),
    );
    this.registry.register(
      'room.lobby.invite.presence.list',
      (session, payload) => this.handler.invitePresenceList(session, payload),
    );
    this.registry.register('room.lobby.invite.respond', (session, payload) =>
      this.handler.inviteRespond(session, payload),
    );
  }
}
