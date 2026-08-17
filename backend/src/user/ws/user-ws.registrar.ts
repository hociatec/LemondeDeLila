import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { WS_EVENTS } from '../../common/ws/ws-events';
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
    this.registry.register(WS_EVENTS.users.list, () => this.users.list());
    this.registry.register(WS_EVENTS.users.get, (_, payload) =>
      this.users.get(payload),
    );
  }
}
