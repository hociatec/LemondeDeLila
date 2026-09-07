import { WS_EVENTS } from '../../../../../platform/realtime/public-api';
import type {
  WsRouteHandler,
  WsRouteRegistry,
} from '../../../../../platform/realtime/public-api';
import type { AdminBotsWsHandler } from './admin-bots-ws.handler';
import type { AdminBroadcastWsHandler } from './admin-broadcast-ws.handler';
import type { AdminBugReportCommentsWsHandler } from './admin-bug-report-comments-ws.handler';
import type { AdminBugReportsWsHandler } from './admin-bug-reports-ws.handler';
import type { AdminChatWsHandler } from './admin-chat-ws.handler';
import type { AdminGamesWsHandler } from './admin-games-ws.handler';
import type { AdminLogsWsHandler } from './admin-logs-ws.handler';
import type { AdminMnemoQuizWsHandler } from './admin-mnemo-quiz-ws.handler';
import type { AdminPerfWsHandler } from './admin-perf-ws.handler';
import type { AdminProfileWsHandler } from './admin-profile-ws.handler';
import type { AdminRolesWsHandler } from './admin-roles-ws.handler';
import type { AdminRoomsWsHandler } from './admin-rooms-ws.handler';
import type { AdminStatsWsHandler } from './admin-stats-ws.handler';
import type { AdminUsersWsHandler } from './admin-users-ws.handler';

export type AdminWsHandlers = {
  rooms: AdminRoomsWsHandler;
  chat: AdminChatWsHandler;
  users: AdminUsersWsHandler;
  games: AdminGamesWsHandler;
  bots: AdminBotsWsHandler;
  roles: AdminRolesWsHandler;
  logs: AdminLogsWsHandler;
  broadcast: AdminBroadcastWsHandler;
  perf: AdminPerfWsHandler;
  profile: AdminProfileWsHandler;
  bugReports: AdminBugReportsWsHandler;
  bugReportComments: AdminBugReportCommentsWsHandler;
  stats: AdminStatsWsHandler;
  mnemoQuiz: AdminMnemoQuizWsHandler;
};

type AdminRouteDefinition = {
  event: string;
  bind: (handlers: AdminWsHandlers) => WsRouteHandler;
};

const ADMIN_WS_ROUTES: AdminRouteDefinition[] = [
  {
    event: WS_EVENTS.admin.users.list,
    bind: (h) => (s, p) => h.users.usersList(s, p),
  },
  {
    event: WS_EVENTS.admin.users.get,
    bind: (h) => (s, p) => h.users.usersGet(s, p),
  },
  {
    event: WS_EVENTS.admin.users.ban,
    bind: (h) => (s, p) => h.users.usersBan(s, p),
  },
  {
    event: WS_EVENTS.admin.users.unban,
    bind: (h) => (s, p) => h.users.usersUnban(s, p),
  },
  {
    event: WS_EVENTS.admin.users.delete,
    bind: (h) => (s, p) => h.users.usersDelete(s, p),
  },
  {
    event: WS_EVENTS.admin.users.roles,
    bind: (h) => (s, p) => h.users.usersUpdateRoles(s, p),
  },
  {
    event: WS_EVENTS.admin.games.list,
    bind: (h) => (s) => h.games.gamesList(s),
  },
  {
    event: WS_EVENTS.admin.games.setEnabled,
    bind: (h) => (s, p) => h.games.gamesSetEnabled(s, p),
  },
  {
    event: WS_EVENTS.admin.games.update,
    bind: (h) => (s, p) => h.games.gamesUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.games.reset,
    bind: (h) => (s, p) => h.games.gamesReset(s, p),
  },
  {
    event: WS_EVENTS.admin.games.categories,
    bind: (h) => (s, p) => Promise.resolve(h.games.gamesCategoriesList(s, p)),
  },
  {
    event: WS_EVENTS.admin.games.categoryCreate,
    bind: (h) => (s, p) => h.games.gamesCategoryCreate(s, p),
  },
  {
    event: WS_EVENTS.admin.games.categoryUpdate,
    bind: (h) => (s, p) => h.games.gamesCategoryUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.games.categoryAssign,
    bind: (h) => (s, p) => h.games.gamesCategoryAssign(s, p),
  },
  {
    event: WS_EVENTS.admin.games.categoryDelete,
    bind: (h) => (s, p) => h.games.gamesCategoryDelete(s, p),
  },
  {
    event: WS_EVENTS.admin.roles.list,
    bind: (h) => (s, p) => h.roles.rolesList(s, p),
  },
  {
    event: WS_EVENTS.admin.roles.definitions,
    bind: (h) => (s) => h.roles.rolesDefinitionsList(s),
  },
  {
    event: WS_EVENTS.admin.roles.create,
    bind: (h) => (s, p) => h.roles.roleDefinitionCreate(s, p),
  },
  {
    event: WS_EVENTS.admin.roles.update,
    bind: (h) => (s, p) => h.roles.roleDefinitionUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.roles.delete,
    bind: (h) => (s, p) => h.roles.roleDefinitionDelete(s, p),
  },
  {
    event: WS_EVENTS.admin.logs.download,
    bind: (h) => (s, p) => h.logs.logsDownload(s, p),
  },
  {
    event: WS_EVENTS.admin.broadcast,
    bind: (h) => (s, p) => h.broadcast.broadcast(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.messages,
    bind: (h) => (s, p) => h.chat.chatMessages(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.settingsGet,
    bind: (h) => (s, p) => Promise.resolve(h.chat.chatSettingsGet(s, p)),
  },
  {
    event: WS_EVENTS.admin.chat.settingsUpdate,
    bind: (h) => (s, p) => h.chat.chatSettingsUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.delete,
    bind: (h) => (s, p) => h.chat.chatDelete(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.clear,
    bind: (h) => (s, p) => h.chat.chatClear(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.ban,
    bind: (h) => (s, p) => h.chat.chatBan(s, p),
  },
  {
    event: WS_EVENTS.admin.chat.unban,
    bind: (h) => (s, p) => h.chat.chatUnban(s, p),
  },
  {
    event: WS_EVENTS.admin.profile.settingsGet,
    bind: (h) => (s, p) => Promise.resolve(h.profile.profileSettingsGet(s, p)),
  },
  {
    event: WS_EVENTS.admin.profile.settingsUpdate,
    bind: (h) => (s, p) => h.profile.profileSettingsUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.stats.resetAll,
    bind: (h) => (s) => h.stats.statsResetAll(s),
  },
  {
    event: WS_EVENTS.admin.bugReports.create,
    bind: (h) => (s, p) => h.bugReports.create(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.list,
    bind: (h) => (s, p) => h.bugReports.list(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.get,
    bind: (h) => (s, p) => h.bugReports.get(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.update,
    bind: (h) => (s, p) => h.bugReports.update(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.updateStatus,
    bind: (h) => (s, p) => h.bugReports.updateStatus(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.delete,
    bind: (h) => (s, p) => h.bugReports.delete(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.commentsList,
    bind: (h) => (s, p) => h.bugReportComments.list(s, p),
  },
  {
    event: WS_EVENTS.admin.bugReports.commentsAdd,
    bind: (h) => (s, p) => h.bugReportComments.add(s, p),
  },
  {
    event: WS_EVENTS.admin.bots.namesList,
    bind: (h) => (s, p) => h.bots.botsNamesList(s, p),
  },
  {
    event: WS_EVENTS.admin.bots.settingsGet,
    bind: (h) => (s, p) => Promise.resolve(h.bots.botSettingsGet(s, p)),
  },
  {
    event: WS_EVENTS.admin.bots.settingsUpdate,
    bind: (h) => (s, p) => h.bots.botSettingsUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.bots.nameCreate,
    bind: (h) => (s, p) => h.bots.botNameCreate(s, p),
  },
  {
    event: WS_EVENTS.admin.bots.nameUpdate,
    bind: (h) => (s, p) => h.bots.botNameUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.bots.nameDelete,
    bind: (h) => (s, p) => h.bots.botNameDelete(s, p),
  },
  {
    event: WS_EVENTS.admin.perf.snapshot,
    bind: (h) => (s, p) => Promise.resolve(h.perf.perfSnapshot(s, p)),
  },
  {
    event: WS_EVENTS.admin.rooms.cleanup,
    bind: (h) => (s, p) => h.rooms.roomsCleanup(s, p),
  },
  {
    event: WS_EVENTS.admin.rooms.list,
    bind: (h) => (s, p) => h.rooms.roomsList(s, p),
  },
  {
    event: WS_EVENTS.admin.rooms.destroy,
    bind: (h) => (s, p) => h.rooms.roomsDestroy(s, p),
  },
  {
    event: WS_EVENTS.admin.rooms.settingsGet,
    bind: (h) => (s, p) => Promise.resolve(h.rooms.roomsSettingsGet(s, p)),
  },
  {
    event: WS_EVENTS.admin.rooms.settingsUpdate,
    bind: (h) => (s, p) => h.rooms.roomsSettingsUpdate(s, p),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.categories,
    bind: (h) => (s, p) => Promise.resolve(h.mnemoQuiz.mnemoCategories(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.categoryCreate,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoCategoryCreate(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.categoryUpdate,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoCategoryUpdate(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.categoryDelete,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoCategoryDelete(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.questions,
    bind: (h) => (s, p) => Promise.resolve(h.mnemoQuiz.mnemoQuestions(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.questionCreate,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoQuestionCreate(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.questionUpdate,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoQuestionUpdate(s, p)),
  },
  {
    event: WS_EVENTS.admin.quiz.mnemo.questionDelete,
    bind: (h) => (s, p) =>
      Promise.resolve(h.mnemoQuiz.mnemoQuestionDelete(s, p)),
  },
];

export function registerAdminWsRoutes(
  registry: WsRouteRegistry,
  handlers: AdminWsHandlers,
): void {
  for (const route of ADMIN_WS_ROUTES) {
    registry.register(route.event, route.bind(handlers));
  }
}
