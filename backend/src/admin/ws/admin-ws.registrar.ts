import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../common/ws/ws-route-registry.service';
import { AdminRoomsWsHandler } from './admin-rooms-ws.handler';
import { AdminChatWsHandler } from './admin-chat-ws.handler';
import { AdminUsersWsHandler } from './admin-users-ws.handler';
import { AdminGamesWsHandler } from './admin-games-ws.handler';
import { AdminBotsWsHandler } from './admin-bots-ws.handler';
import { AdminRolesWsHandler } from './admin-roles-ws.handler';
import { AdminLogsWsHandler } from './admin-logs-ws.handler';
import { AdminBroadcastWsHandler } from './admin-broadcast-ws.handler';
import { AdminClientUpdatesWsHandler } from './admin-client-updates-ws.handler';
import { AdminPerfWsHandler } from './admin-perf-ws.handler';
import { AdminProfileWsHandler } from './admin-profile-ws.handler';
import { AdminBugReportsWsHandler } from './admin-bug-reports-ws.handler';
import { AdminBugReportCommentsWsHandler } from './admin-bug-report-comments-ws.handler';
import { AdminStatsWsHandler } from './admin-stats-ws.handler';

@Injectable()
export class AdminWsRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: WsRouteRegistry,
    private readonly rooms: AdminRoomsWsHandler,
    private readonly chat: AdminChatWsHandler,
    private readonly users: AdminUsersWsHandler,
    private readonly games: AdminGamesWsHandler,
    private readonly bots: AdminBotsWsHandler,
    private readonly roles: AdminRolesWsHandler,
    private readonly logs: AdminLogsWsHandler,
    private readonly broadcast: AdminBroadcastWsHandler,
    private readonly clientUpdates: AdminClientUpdatesWsHandler,
    private readonly perf: AdminPerfWsHandler,
    private readonly profile: AdminProfileWsHandler,
    private readonly bugReports: AdminBugReportsWsHandler,
    private readonly bugReportComments: AdminBugReportCommentsWsHandler,
    private readonly stats: AdminStatsWsHandler,
  ) {}

  onModuleInit() {
    this.registry.register('admin.users.list', (s, p) =>
      this.users.usersList(s, p),
    );
    this.registry.register('admin.users.get', (s, p) =>
      this.users.usersGet(s, p),
    );
    this.registry.register('admin.users.ban', (s, p) =>
      this.users.usersBan(s, p),
    );
    this.registry.register('admin.users.unban', (s, p) =>
      this.users.usersUnban(s, p),
    );
    this.registry.register('admin.users.delete', (s, p) =>
      this.users.usersDelete(s, p),
    );

    this.registry.register('admin.games.list', (s) => this.games.gamesList(s));
    this.registry.register('admin.games.setEnabled', (s, p) =>
      this.games.gamesSetEnabled(s, p),
    );
    this.registry.register('admin.games.update', (s, p) =>
      this.games.gamesUpdate(s, p),
    );
    this.registry.register('admin.games.reset', (s, p) =>
      this.games.gamesReset(s, p),
    );
    this.registry.register('admin.games.categories', (s, p) =>
      this.games.gamesCategoriesList(s, p),
    );
    this.registry.register('admin.games.category.create', (s, p) =>
      this.games.gamesCategoryCreate(s, p),
    );
    this.registry.register('admin.games.category.update', (s, p) =>
      this.games.gamesCategoryUpdate(s, p),
    );
    this.registry.register('admin.games.category.assign', (s, p) =>
      this.games.gamesCategoryAssign(s, p),
    );
    this.registry.register('admin.roles.list', (s, p) =>
      this.roles.rolesList(s, p),
    );
    this.registry.register('admin.users.roles', (s, p) =>
      this.users.usersUpdateRoles(s, p),
    );
    this.registry.register('admin.roles.definitions', (s) =>
      this.roles.rolesDefinitionsList(s),
    );
    this.registry.register('admin.roles.create', (s, p) =>
      this.roles.roleDefinitionCreate(s, p),
    );
    this.registry.register('admin.roles.update', (s, p) =>
      this.roles.roleDefinitionUpdate(s, p),
    );
    this.registry.register('admin.roles.delete', (s, p) =>
      this.roles.roleDefinitionDelete(s, p),
    );
    this.registry.register('admin.logs.download', (s, p) =>
      this.logs.logsDownload(s, p),
    );

    this.registry.register('admin.broadcast', (s, p) =>
      this.broadcast.broadcast(s, p),
    );

    this.registry.register('admin.client.update.announce', (s, p) =>
      this.clientUpdates.clientUpdateAnnounce(s, p),
    );
    this.registry.register('admin.client.update.forceLatest', (s, p) =>
      this.clientUpdates.clientUpdateForceLatest(s, p),
    );

    this.registry.register('admin.chat.messages', (s, p) =>
      this.chat.chatMessages(s, p),
    );
    this.registry.register('admin.chat.settings.get', (s, p) =>
      this.chat.chatSettingsGet(s, p),
    );
    this.registry.register('admin.chat.settings.update', (s, p) =>
      this.chat.chatSettingsUpdate(s, p),
    );
    this.registry.register('admin.chat.delete', (s, p) =>
      this.chat.chatDelete(s, p),
    );
    this.registry.register('admin.chat.clear', (s, p) =>
      this.chat.chatClear(s, p),
    );
    this.registry.register('admin.chat.ban', (s, p) => this.chat.chatBan(s, p));
    this.registry.register('admin.chat.unban', (s, p) =>
      this.chat.chatUnban(s, p),
    );

    this.registry.register('admin.profile.settings.get', (s, p) =>
      this.profile.profileSettingsGet(s, p),
    );
    this.registry.register('admin.profile.settings.update', (s, p) =>
      this.profile.profileSettingsUpdate(s, p),
    );

    this.registry.register('admin.stats.resetAll', (s) =>
      this.stats.statsResetAll(s),
    );

    this.registry.register('admin.bugReports.create', (s, p) =>
      this.bugReports.create(s, p),
    );
    this.registry.register('admin.bugReports.list', (s, p) =>
      this.bugReports.list(s, p),
    );
    this.registry.register('admin.bugReports.get', (s, p) =>
      this.bugReports.get(s, p),
    );
    this.registry.register('admin.bugReports.update', (s, p) =>
      this.bugReports.update(s, p),
    );
    this.registry.register('admin.bugReports.updateStatus', (s, p) =>
      this.bugReports.updateStatus(s, p),
    );
    this.registry.register('admin.bugReports.delete', (s, p) =>
      this.bugReports.delete(s, p),
    );

    this.registry.register('admin.bugReports.comments.list', (s, p) =>
      this.bugReportComments.list(s, p),
    );
    this.registry.register('admin.bugReports.comments.add', (s, p) =>
      this.bugReportComments.add(s, p),
    );

    this.registry.register('admin.bots.names.list', (s, p) =>
      this.bots.botsNamesList(s, p),
    );
    this.registry.register('admin.bots.settings.get', (s, p) =>
      this.bots.botSettingsGet(s, p),
    );
    this.registry.register('admin.bots.settings.update', (s, p) =>
      this.bots.botSettingsUpdate(s, p),
    );
    this.registry.register('admin.bots.name.create', (s, p) =>
      this.bots.botNameCreate(s, p),
    );
    this.registry.register('admin.bots.name.update', (s, p) =>
      this.bots.botNameUpdate(s, p),
    );
    this.registry.register('admin.bots.name.delete', (s, p) =>
      this.bots.botNameDelete(s, p),
    );

    this.registry.register('admin.perf.snapshot', (s, p) =>
      this.perf.perfSnapshot(s, p),
    );

    this.registry.register('admin.rooms.cleanup', (s, p) =>
      this.rooms.roomsCleanup(s, p),
    );

    this.registry.register('admin.rooms.list', (s, p) =>
      this.rooms.roomsList(s, p),
    );

    this.registry.register('admin.rooms.destroy', (s, p) =>
      this.rooms.roomsDestroy(s, p),
    );

    this.registry.register('admin.rooms.settings.get', (s, p) =>
      this.rooms.roomsSettingsGet(s, p),
    );
    this.registry.register('admin.rooms.settings.update', (s, p) =>
      this.rooms.roomsSettingsUpdate(s, p),
    );
  }
}
