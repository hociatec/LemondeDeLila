import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../../platform/realtime/public-api';
import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import { AuthWsHandler } from './auth-ws.handler';
import { UserWsHandler } from './user-ws.handler';

@Injectable()
export class UserWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly auth: AuthWsHandler,
    private readonly users: UserWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register(WS_EVENTS.auth.register, (_, payload) =>
      this.auth.register(payload),
    );
    this.registry.register(WS_EVENTS.auth.login, (_, payload) =>
      this.auth.login(payload),
    );
    this.registry.register(WS_EVENTS.auth.refresh, (_, payload) =>
      this.auth.refresh(payload),
    );
    this.registry.register(WS_EVENTS.auth.logout, (_, payload) =>
      this.auth.logout(payload),
    );
    this.registry.register(WS_EVENTS.users.list, (session, payload) =>
      this.users.list(session, payload),
    );
    this.registry.register(WS_EVENTS.users.get, (session, payload) =>
      this.users.get(session, payload),
    );
  }
}
