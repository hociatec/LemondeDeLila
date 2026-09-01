import { AdminBotsWsHandler } from '../infrastructure/presentation/ws/admin-bots-ws.handler';
import { AdminBroadcastWsHandler } from '../infrastructure/presentation/ws/admin-broadcast-ws.handler';
import { AdminBugReportCommentsWsHandler } from '../infrastructure/presentation/ws/admin-bug-report-comments-ws.handler';
import { AdminBugReportsWsHandler } from '../infrastructure/presentation/ws/admin-bug-reports-ws.handler';
import { AdminChatWsHandler } from '../infrastructure/presentation/ws/admin-chat-ws.handler';
import { AdminGamesWsHandler } from '../infrastructure/presentation/ws/admin-games-ws.handler';
import { AdminLogsWsHandler } from '../infrastructure/presentation/ws/admin-logs-ws.handler';
import { AdminMnemoQuizWsHandler } from '../infrastructure/presentation/ws/admin-mnemo-quiz-ws.handler';
import { AdminPerfWsHandler } from '../infrastructure/presentation/ws/admin-perf-ws.handler';
import { AdminProfileWsHandler } from '../infrastructure/presentation/ws/admin-profile-ws.handler';
import { AdminRolesWsHandler } from '../infrastructure/presentation/ws/admin-roles-ws.handler';
import { AdminRoomsWsHandler } from '../infrastructure/presentation/ws/admin-rooms-ws.handler';
import { AdminStatsWsHandler } from '../infrastructure/presentation/ws/admin-stats-ws.handler';
import { AdminUsersWsHandler } from '../infrastructure/presentation/ws/admin-users-ws.handler';
import { AdminWsRegistrar } from '../infrastructure/presentation/ws/admin-ws.registrar';

export const ADMIN_PRESENTATION_PROVIDERS = [
  AdminRoomsWsHandler,
  AdminChatWsHandler,
  AdminUsersWsHandler,
  AdminGamesWsHandler,
  AdminBotsWsHandler,
  AdminRolesWsHandler,
  AdminLogsWsHandler,
  AdminBroadcastWsHandler,
  AdminPerfWsHandler,
  AdminProfileWsHandler,
  AdminBugReportsWsHandler,
  AdminBugReportCommentsWsHandler,
  AdminStatsWsHandler,
  AdminMnemoQuizWsHandler,
  AdminWsRegistrar,
];
