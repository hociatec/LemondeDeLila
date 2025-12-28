import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { AdminWsHandler } from './admin-ws.handler';

@Injectable()
export class AdminWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly handler: AdminWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('admin.users.list', (s, p) =>
      this.handler.usersList(s, p),
    );
    this.registry.register('admin.users.get', (s, p) =>
      this.handler.usersGet(s, p),
    );
    this.registry.register('admin.users.ban', (s, p) =>
      this.handler.usersBan(s, p),
    );
    this.registry.register('admin.users.unban', (s, p) =>
      this.handler.usersUnban(s, p),
    );
    this.registry.register('admin.users.delete', (s, p) =>
      this.handler.usersDelete(s, p),
    );

    this.registry.register('admin.games.list', (s) => this.handler.gamesList(s));
    this.registry.register('admin.games.setEnabled', (s, p) =>
      this.handler.gamesSetEnabled(s, p),
    );
    this.registry.register('admin.games.update', (s, p) =>
      this.handler.gamesUpdate(s, p),
    );
    this.registry.register('admin.games.reset', (s, p) =>
      this.handler.gamesReset(s, p),
    );
    this.registry.register('admin.roles.list', (s, p) =>
      this.handler.rolesList(s, p),
    );
    this.registry.register('admin.users.roles', (s, p) =>
      this.handler.usersUpdateRoles(s, p),
    );
    this.registry.register('admin.roles.definitions', (s) =>
      this.handler.rolesDefinitionsList(s),
    );
    this.registry.register('admin.roles.create', (s, p) =>
      this.handler.roleDefinitionCreate(s, p),
    );
    this.registry.register('admin.roles.update', (s, p) =>
      this.handler.roleDefinitionUpdate(s, p),
    );
    this.registry.register('admin.roles.delete', (s, p) =>
      this.handler.roleDefinitionDelete(s, p),
    );
    this.registry.register('admin.logs.download', (s, p) =>
      this.handler.logsDownload(s, p),
    );

    this.registry.register('admin.broadcast', (s, p) =>
      this.handler.broadcast(s, p),
    );
  }
}
