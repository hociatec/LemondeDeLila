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
import { AdminMnemoQuizWsHandler } from './admin-mnemo-quiz-ws.handler';
import { WS_EVENTS } from '../../common/ws/ws-events';

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
    this.registry.register(WS_EVENTS.admin.users.list, (s, p) =>
      this.users.usersList(s, p),
    );
    this.registry.register(WS_EVENTS.admin.users.get, (s, p) =>
      this.users.usersGet(s, p),
    );
    this.registry.register(WS_EVENTS.admin.users.ban, (s, p) =>
      this.users.usersBan(s, p),
    );
    this.registry.register(WS_EVENTS.admin.users.unban, (s, p) =>
      this.users.usersUnban(s, p),
    );
    this.registry.register(WS_EVENTS.admin.users.delete, (s, p) =>
      this.users.usersDelete(s, p),
    );

    this.registry.register(WS_EVENTS.admin.games.list, (s) => this.games.gamesList(s));
    this.registry.register(WS_EVENTS.admin.games.setEnabled, (s, p) =>
      this.games.gamesSetEnabled(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.update, (s, p) =>
      this.games.gamesUpdate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.reset, (s, p) =>
      this.games.gamesReset(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.categories, (s, p) =>
      Promise.resolve(this.games.gamesCategoriesList(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.games.categoryCreate, (s, p) =>
      this.games.gamesCategoryCreate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.categoryUpdate, (s, p) =>
      this.games.gamesCategoryUpdate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.categoryAssign, (s, p) =>
      this.games.gamesCategoryAssign(s, p),
    );
    this.registry.register(WS_EVENTS.admin.games.categoryDelete, (s, p) =>
      this.games.gamesCategoryDelete(s, p),
    );
    this.registry.register(WS_EVENTS.admin.roles.list, (s, p) =>
      this.roles.rolesList(s, p),
    );
    this.registry.register(WS_EVENTS.admin.users.roles, (s, p) =>
      this.users.usersUpdateRoles(s, p),
    );
    this.registry.register(WS_EVENTS.admin.roles.definitions, (s) =>
      this.roles.rolesDefinitionsList(s),
    );
    this.registry.register(WS_EVENTS.admin.roles.create, (s, p) =>
      this.roles.roleDefinitionCreate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.roles.update, (s, p) =>
      this.roles.roleDefinitionUpdate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.roles.delete, (s, p) =>
      this.roles.roleDefinitionDelete(s, p),
    );
    this.registry.register(WS_EVENTS.admin.logs.download, (s, p) =>
      this.logs.logsDownload(s, p),
    );

    this.registry.register(WS_EVENTS.admin.broadcast, (s, p) =>
      this.broadcast.broadcast(s, p),
    );

    this.registry.register(WS_EVENTS.admin.clientUpdate.announce, (s, p) =>
      this.clientUpdates.clientUpdateAnnounce(s, p),
    );
    this.registry.register(WS_EVENTS.admin.clientUpdate.forceLatest, (s, p) =>
      this.clientUpdates.clientUpdateForceLatest(s, p),
    );
    this.registry.register(WS_EVENTS.admin.clientUpdate.schedule, (s, p) =>
      this.clientUpdates.clientUpdateSchedule(s, p),
    );

    this.registry.register(WS_EVENTS.admin.chat.messages, (s, p) =>
      this.chat.chatMessages(s, p),
    );
    this.registry.register(WS_EVENTS.admin.chat.settingsGet, (s, p) =>
      Promise.resolve(this.chat.chatSettingsGet(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.chat.settingsUpdate, (s, p) =>
      this.chat.chatSettingsUpdate(s, p),
    );

    // Quiz (Arche de Mnémosyne)
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.categories, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoCategories(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.categoryCreate, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoCategoryCreate(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.categoryUpdate, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoCategoryUpdate(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.categoryDelete, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoCategoryDelete(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.questions, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoQuestions(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.questionCreate, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoQuestionCreate(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.questionUpdate, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoQuestionUpdate(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.quiz.mnemo.questionDelete, (s, p) =>
      Promise.resolve(this.mnemoQuiz.mnemoQuestionDelete(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.chat.delete, (s, p) =>
      this.chat.chatDelete(s, p),
    );
    this.registry.register(WS_EVENTS.admin.chat.clear, (s, p) =>
      this.chat.chatClear(s, p),
    );
    this.registry.register(WS_EVENTS.admin.chat.ban, (s, p) => this.chat.chatBan(s, p));
    this.registry.register(WS_EVENTS.admin.chat.unban, (s, p) =>
      this.chat.chatUnban(s, p),
    );

    this.registry.register(WS_EVENTS.admin.profile.settingsGet, (s, p) =>
      Promise.resolve(this.profile.profileSettingsGet(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.profile.settingsUpdate, (s, p) =>
      this.profile.profileSettingsUpdate(s, p),
    );

    this.registry.register(WS_EVENTS.admin.stats.resetAll, (s) =>
      this.stats.statsResetAll(s),
    );

    this.registry.register(WS_EVENTS.admin.bugReports.create, (s, p) =>
      this.bugReports.create(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.list, (s, p) =>
      this.bugReports.list(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.get, (s, p) =>
      this.bugReports.get(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.update, (s, p) =>
      this.bugReports.update(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.updateStatus, (s, p) =>
      this.bugReports.updateStatus(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.delete, (s, p) =>
      this.bugReports.delete(s, p),
    );

    this.registry.register(WS_EVENTS.admin.bugReports.commentsList, (s, p) =>
      this.bugReportComments.list(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bugReports.commentsAdd, (s, p) =>
      this.bugReportComments.add(s, p),
    );

    this.registry.register(WS_EVENTS.admin.bots.namesList, (s, p) =>
      this.bots.botsNamesList(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bots.settingsGet, (s, p) =>
      Promise.resolve(this.bots.botSettingsGet(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.bots.settingsUpdate, (s, p) =>
      this.bots.botSettingsUpdate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bots.nameCreate, (s, p) =>
      this.bots.botNameCreate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bots.nameUpdate, (s, p) =>
      this.bots.botNameUpdate(s, p),
    );
    this.registry.register(WS_EVENTS.admin.bots.nameDelete, (s, p) =>
      this.bots.botNameDelete(s, p),
    );

    this.registry.register(WS_EVENTS.admin.perf.snapshot, (s, p) =>
      Promise.resolve(this.perf.perfSnapshot(s, p)),
    );

    this.registry.register(WS_EVENTS.admin.rooms.cleanup, (s, p) =>
      this.rooms.roomsCleanup(s, p),
    );

    this.registry.register(WS_EVENTS.admin.rooms.list, (s, p) =>
      this.rooms.roomsList(s, p),
    );

    this.registry.register(WS_EVENTS.admin.rooms.destroy, (s, p) =>
      this.rooms.roomsDestroy(s, p),
    );

    this.registry.register(WS_EVENTS.admin.rooms.settingsGet, (s, p) =>
      Promise.resolve(this.rooms.roomsSettingsGet(s, p)),
    );
    this.registry.register(WS_EVENTS.admin.rooms.settingsUpdate, (s, p) =>
      this.rooms.roomsSettingsUpdate(s, p),
    );
  }
}


