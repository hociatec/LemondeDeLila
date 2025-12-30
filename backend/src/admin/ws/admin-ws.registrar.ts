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
    this.registry.register('admin.games.categories', (s, p) =>
      this.handler.gamesCategoriesList(s, p),
    );
    this.registry.register('admin.games.category.create', (s, p) =>
      this.handler.gamesCategoryCreate(s, p),
    );
    this.registry.register('admin.games.category.update', (s, p) =>
      this.handler.gamesCategoryUpdate(s, p),
    );
    this.registry.register('admin.games.category.assign', (s, p) =>
      this.handler.gamesCategoryAssign(s, p),
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

    this.registry.register('admin.client.update.announce', (s, p) =>
      this.handler.clientUpdateAnnounce(s, p),
    );
    this.registry.register('admin.client.update.forceLatest', (s, p) =>
      this.handler.clientUpdateForceLatest(s, p),
    );

    this.registry.register('admin.chat.messages', (s, p) =>
      this.handler.chatMessages(s, p),
    );
    this.registry.register('admin.chat.delete', (s, p) =>
      this.handler.chatDelete(s, p),
    );
    this.registry.register('admin.chat.clear', (s, p) =>
      this.handler.chatClear(s, p),
    );
    this.registry.register('admin.chat.ban', (s, p) =>
      this.handler.chatBan(s, p),
    );
    this.registry.register('admin.chat.unban', (s, p) =>
      this.handler.chatUnban(s, p),
    );

    this.registry.register('admin.bots.names.list', (s, p) =>
      this.handler.botsNamesList(s, p),
    );
    this.registry.register('admin.bots.settings.get', (s, p) =>
      this.handler.botSettingsGet(s, p),
    );
    this.registry.register('admin.bots.settings.update', (s, p) =>
      this.handler.botSettingsUpdate(s, p),
    );
    this.registry.register('admin.bots.name.create', (s, p) =>
      this.handler.botNameCreate(s, p),
    );
    this.registry.register('admin.bots.name.update', (s, p) =>
      this.handler.botNameUpdate(s, p),
    );
    this.registry.register('admin.bots.name.delete', (s, p) =>
      this.handler.botNameDelete(s, p),
    );

    this.registry.register('admin.perf.snapshot', (s, p) =>
      this.handler.perfSnapshot(s, p),
    );
  }
}
