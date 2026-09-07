import { AdminBroadcastService } from '../application/use-cases/admin-broadcast/admin-broadcast.service';
import { AdminBotsService } from '../application/use-cases/admin-bots/admin-bots.service';
import { AdminBugReportCommentsService } from '../application/use-cases/admin-bug-reports/admin-bug-report-comments.service';
import { AdminBugReportsService } from '../application/use-cases/admin-bug-reports/admin-bug-reports.service';
import { AdminChatModerationService } from '../application/use-cases/admin-chat/admin-chat-moderation.service';
import { AdminChatService } from '../application/use-cases/admin-chat/admin-chat.service';
import { AdminDaemonReloadService } from '../application/use-cases/admin-maintenance/admin-daemon-reload.service';
import { AdminDryRunBuildService } from '../application/use-cases/admin-maintenance/admin-dry-run-build.service';
import { AdminRunMigrationsService } from '../application/use-cases/admin-maintenance/admin-run-migrations.service';
import { GetAdminBackendServiceStatusService } from '../application/use-cases/admin-maintenance/get-admin-backend-service-status.service';
import { GetAdminDeployLogsService } from '../application/use-cases/admin-maintenance/get-admin-deploy-logs.service';
import { GetAdminDeployStatusService } from '../application/use-cases/admin-maintenance/get-admin-deploy-status.service';
import { GetAdminHealthService } from '../application/use-cases/admin-maintenance/get-admin-health.service';
import { StartAdminBuildAndRestartBackendService } from '../application/use-cases/admin-maintenance/start-admin-build-and-restart-backend.service';
import { StartAdminDeployService } from '../application/use-cases/admin-maintenance/start-admin-deploy.service';
import { StartAdminRestartBackendService } from '../application/use-cases/admin-maintenance/start-admin-restart-backend.service';
import { AdminGameCategoriesService } from '../application/use-cases/admin-games/admin-game-categories.service';
import { AdminGameOverridesService } from '../application/use-cases/admin-games/admin-game-overrides.service';
import { AdminGamesManagementService } from '../application/use-cases/admin-games/admin-games-management.service';
import { AdminGamesPresenterService } from '../application/use-cases/admin-games/admin-games-presenter.service';
import { AdminLogsService } from '../infrastructure/filesystem/admin-logs.service';
import { AdminMnemoQuizCategoriesService } from '../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-categories.service';
import { AdminMnemoQuizPresenterService } from '../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-presenter.service';
import { AdminMnemoQuizQuestionsService } from '../application/use-cases/admin-mnemo-quiz/admin-mnemo-quiz-questions.service';
import { AdminPerfService } from '../application/use-cases/admin-perf/admin-perf.service';
import { AdminProfileService } from '../application/use-cases/admin-profile/admin-profile.service';
import { AdminRoleDefinitionsCatalogService } from '../application/use-cases/admin-roles/admin-role-definitions-catalog.service';
import { AdminRolesService } from '../application/use-cases/admin-roles/admin-roles.service';
import { AdminRoomsService } from '../application/use-cases/admin-rooms/admin-rooms.service';
import { AdminStatsService } from '../application/use-cases/admin-stats/admin-stats.service';
import { MnemoQuizStoreService } from '../infrastructure/storage/mnemo-quiz-store.service';
import { ADMIN_MNEMO_QUIZ_STORE_PORT } from '../application/ports/admin-mnemo-quiz-store.port';
import { AdminUserBanPolicyService } from '../application/use-cases/admin-users/admin-user-ban-policy.service';
import { AdminUserPasswordService } from '../application/use-cases/admin-users/admin-user-password.service';
import { AdminUserRolesUpdateService } from '../application/use-cases/admin-users/admin-user-roles-update.service';
import { AdminUsersCommandService } from '../application/use-cases/admin-users/admin-users-command.service';
import { AdminUsersQueryService } from '../application/use-cases/admin-users/admin-users-query.service';

export const ADMIN_USE_CASE_PROVIDERS = [
  MnemoQuizStoreService,
  {
    provide: ADMIN_MNEMO_QUIZ_STORE_PORT,
    useExisting: MnemoQuizStoreService,
  },
  AdminUsersQueryService,
  AdminUserPasswordService,
  AdminUserBanPolicyService,
  AdminUserRolesUpdateService,
  AdminUsersCommandService,
  StartAdminBuildAndRestartBackendService,
  StartAdminDeployService,
  StartAdminRestartBackendService,
  AdminDaemonReloadService,
  AdminDryRunBuildService,
  AdminRunMigrationsService,
  GetAdminHealthService,
  GetAdminDeployStatusService,
  GetAdminBackendServiceStatusService,
  GetAdminDeployLogsService,
  AdminGameCategoriesService,
  AdminGamesManagementService,
  AdminGameOverridesService,
  AdminGamesPresenterService,
  AdminMnemoQuizCategoriesService,
  AdminMnemoQuizPresenterService,
  AdminMnemoQuizQuestionsService,
  AdminBroadcastService,
  AdminBugReportsService,
  AdminBugReportCommentsService,
  AdminBotsService,
  AdminChatService,
  AdminChatModerationService,
  AdminLogsService,
  AdminPerfService,
  AdminProfileService,
  AdminRoleDefinitionsCatalogService,
  AdminRolesService,
  AdminRoomsService,
  AdminStatsService,
];
