import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../realtime/public-api';
import { RoomLobbyWsHandler } from './room-lobby-ws.handler';

@Injectable()
export class RoomWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: RoomLobbyWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('rooms.public.list', (session, payload) =>
      this.handler.listPublic(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.list', (session, payload) =>
      this.handler.listPublic(session, payload, 'lobby'),
    );
    this.registry.register('rooms.public.join', (session, payload) =>
      this.handler.joinPublic(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.join', (session, payload) =>
      this.handler.joinPublic(session, payload, 'lobby'),
    );
    this.registry.register('rooms.public.leave', (session, payload) =>
      this.handler.leavePublic(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.leave', (session, payload) =>
      this.handler.leavePublic(session, payload, 'lobby'),
    );
    this.registry.register('rooms.public.spectate', (session, payload) =>
      this.handler.spectatePublic(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.spectate', (session, payload) =>
      this.handler.spectatePublic(session, payload, 'lobby'),
    );
    this.registry.register('rooms.public.subscribe', (session, payload) =>
      this.handler.subscribePublic(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.subscribe', (session, payload) =>
      this.handler.subscribePublic(session, payload, 'lobby'),
    );
    this.registry.register('rooms.public.unsubscribe', (session) =>
      this.handler.unsubscribePublic(session, 'legacy'),
    );
    this.registry.register('room.lobby.unsubscribe', (session) =>
      this.handler.unsubscribePublic(session, 'lobby'),
    );
    this.registry.register('rooms.invite.send', (session, payload) =>
      this.handler.inviteSend(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.invite.send', (session, payload) =>
      this.handler.inviteSend(session, payload, 'lobby'),
    );
    this.registry.register('rooms.invite.presence.list', (session, payload) =>
      this.handler.invitePresenceList(session, payload, 'legacy'),
    );
    this.registry.register(
      'room.lobby.invite.presence.list',
      (session, payload) =>
        this.handler.invitePresenceList(session, payload, 'lobby'),
    );
    this.registry.register('rooms.invite.respond', (session, payload) =>
      this.handler.inviteRespond(session, payload, 'legacy'),
    );
    this.registry.register('room.lobby.invite.respond', (session, payload) =>
      this.handler.inviteRespond(session, payload, 'lobby'),
    );
  }
}

