import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
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
    this.registry.register('auth.register', (_, payload) =>
      this.auth.register(payload),
    );
    this.registry.register('auth.login', (_, payload) =>
      this.auth.login(payload),
    );
    this.registry.register('users.list', () => this.users.list());
    this.registry.register('users.get', (_, payload) =>
      this.users.get(payload),
    );
  }
}
