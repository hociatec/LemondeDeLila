import { Injectable, OnModuleInit } from '@nestjs/common';
import { WsRouteRegistry } from '../../../../common/ws/ws-route-registry.service';
import { AdminBotsWsHandler } from './admin-bots-ws.handler';
import { AdminBroadcastWsHandler } from './admin-broadcast-ws.handler';
import { AdminBugReportCommentsWsHandler } from './admin-bug-report-comments-ws.handler';
import { AdminBugReportsWsHandler } from './admin-bug-reports-ws.handler';
import { AdminChatWsHandler } from './admin-chat-ws.handler';
import { AdminClientUpdatesWsHandler } from './admin-client-updates-ws.handler';
import { AdminGamesWsHandler } from './admin-games-ws.handler';
import { AdminLogsWsHandler } from './admin-logs-ws.handler';
import { AdminMnemoQuizWsHandler } from './admin-mnemo-quiz-ws.handler';
import { AdminPerfWsHandler } from './admin-perf-ws.handler';
import { AdminProfileWsHandler } from './admin-profile-ws.handler';
import { AdminRolesWsHandler } from './admin-roles-ws.handler';
import { AdminRoomsWsHandler } from './admin-rooms-ws.handler';
import { AdminStatsWsHandler } from './admin-stats-ws.handler';
import { AdminUsersWsHandler } from './admin-users-ws.handler';
import { registerAdminWsRoutes } from './admin-ws-routes';

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
    private readonly mnemoQuiz: AdminMnemoQuizWsHandler,
  ) {}

  onModuleInit() {
    registerAdminWsRoutes(this.registry, {
      rooms: this.rooms,
      chat: this.chat,
      users: this.users,
      games: this.games,
      bots: this.bots,
      roles: this.roles,
      logs: this.logs,
      broadcast: this.broadcast,
      clientUpdates: this.clientUpdates,
      perf: this.perf,
      profile: this.profile,
      bugReports: this.bugReports,
      bugReportComments: this.bugReportComments,
      stats: this.stats,
      mnemoQuiz: this.mnemoQuiz,
    });
  }
}




