import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { RoomDirectoryWsHandler } from './room-directory-ws.handler';

@Injectable()
export class RoomWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: RoomDirectoryWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('rooms.public.list', (session, payload) =>
      this.handler.listPublic(session, payload),
    );
    this.registry.register('rooms.public.join', (session, payload) =>
      this.handler.joinPublic(session, payload),
    );
    this.registry.register('rooms.public.leave', (session, payload) =>
      this.handler.leavePublic(session, payload),
    );
    this.registry.register('rooms.public.spectate', (session, payload) =>
      this.handler.spectatePublic(session, payload),
    );
    this.registry.register('rooms.invite.send', (session, payload) =>
      this.handler.inviteSend(session, payload),
    );
    this.registry.register('rooms.invite.respond', (session, payload) =>
      this.handler.inviteRespond(session, payload),
    );
  }
}
