"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../user/entities/user.entity");
const admin_users_service_1 = require("./services/admin-users.service");
const role_definitions_service_1 = require("./services/role-definitions.service");
const admin_users_controller_1 = require("./controllers/admin-users.controller");
const http_jwt_guard_1 = require("../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../common/guards/admin-role.guard");
const admin_ws_registrar_1 = require("./ws/admin-ws.registrar");
const admin_rooms_ws_handler_1 = require("./ws/admin-rooms-ws.handler");
const admin_chat_ws_handler_1 = require("./ws/admin-chat-ws.handler");
const admin_users_ws_handler_1 = require("./ws/admin-users-ws.handler");
const admin_games_ws_handler_1 = require("./ws/admin-games-ws.handler");
const admin_bots_ws_handler_1 = require("./ws/admin-bots-ws.handler");
const admin_roles_ws_handler_1 = require("./ws/admin-roles-ws.handler");
const admin_logs_ws_handler_1 = require("./ws/admin-logs-ws.handler");
const admin_broadcast_ws_handler_1 = require("./ws/admin-broadcast-ws.handler");
const admin_client_updates_ws_handler_1 = require("./ws/admin-client-updates-ws.handler");
const admin_perf_ws_handler_1 = require("./ws/admin-perf-ws.handler");
const validation_module_1 = require("../common/validation/validation.module");
const game_registry_module_1 = require("../game/engine/game-registry.module");
const notification_module_1 = require("../notification/notification.module");
const catalog_module_1 = require("../catalog/catalog.module");
const bot_module_1 = require("../bot/bot.module");
const bot_module_2 = require("../game/modules/bot/bot.module");
const role_definition_entity_1 = require("./entities/role-definition.entity");
const client_updates_module_1 = require("../client-updates/client-updates.module");
const chat_module_1 = require("../chat/chat.module");
const room_module_1 = require("../room/room.module");
const admin_catalog_invalidation_service_1 = require("./services/admin-catalog-invalidation.service");
const social_module_1 = require("../social/social.module");
const admin_profile_ws_handler_1 = require("./ws/admin-profile-ws.handler");
const bug_reports_module_1 = require("../bug-reports/bug-reports.module");
const admin_bug_reports_ws_handler_1 = require("./ws/admin-bug-reports-ws.handler");
const admin_bug_report_comments_ws_handler_1 = require("./ws/admin-bug-report-comments-ws.handler");
const admin_maintenance_controller_1 = require("./controllers/admin-maintenance.controller");
const admin_maintenance_guard_1 = require("./guards/admin-maintenance.guard");
const admin_maintenance_service_1 = require("./services/admin-maintenance.service");
const stats_module_1 = require("../stats/stats.module");
const admin_stats_ws_handler_1 = require("./ws/admin-stats-ws.handler");
const arche_de_mnemosyne_module_1 = require("../game/games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.module");
const admin_mnemo_quiz_ws_handler_1 = require("./ws/admin-mnemo-quiz-ws.handler");
let AdminModule = class AdminModule {
    wsRegistrar;
    constructor(wsRegistrar) {
        this.wsRegistrar = wsRegistrar;
        void this.wsRegistrar;
    }
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, role_definition_entity_1.RoleDefinitionEntity]),
            validation_module_1.ValidationModule,
            game_registry_module_1.GameRegistryModule,
            arche_de_mnemosyne_module_1.ArcheDeMnemosyneModule,
            notification_module_1.NotificationModule,
            client_updates_module_1.ClientUpdatesModule,
            chat_module_1.ChatModule,
            catalog_module_1.CatalogModule,
            bot_module_1.BotModule,
            bot_module_2.BotModule,
            room_module_1.RoomModule,
            social_module_1.SocialModule,
            bug_reports_module_1.BugReportsModule,
            stats_module_1.StatsModule,
        ],
        controllers: [admin_users_controller_1.AdminUsersController, admin_maintenance_controller_1.AdminMaintenanceController],
        providers: [
            admin_catalog_invalidation_service_1.AdminCatalogInvalidationService,
            admin_users_service_1.AdminUsersService,
            role_definitions_service_1.RoleDefinitionsService,
            http_jwt_guard_1.HttpJwtGuard,
            admin_role_guard_1.AdminRoleGuard,
            admin_maintenance_guard_1.AdminMaintenanceGuard,
            admin_maintenance_service_1.AdminMaintenanceService,
            admin_rooms_ws_handler_1.AdminRoomsWsHandler,
            admin_chat_ws_handler_1.AdminChatWsHandler,
            admin_users_ws_handler_1.AdminUsersWsHandler,
            admin_games_ws_handler_1.AdminGamesWsHandler,
            admin_bots_ws_handler_1.AdminBotsWsHandler,
            admin_roles_ws_handler_1.AdminRolesWsHandler,
            admin_logs_ws_handler_1.AdminLogsWsHandler,
            admin_broadcast_ws_handler_1.AdminBroadcastWsHandler,
            admin_client_updates_ws_handler_1.AdminClientUpdatesWsHandler,
            admin_perf_ws_handler_1.AdminPerfWsHandler,
            admin_profile_ws_handler_1.AdminProfileWsHandler,
            admin_bug_reports_ws_handler_1.AdminBugReportsWsHandler,
            admin_bug_report_comments_ws_handler_1.AdminBugReportCommentsWsHandler,
            admin_stats_ws_handler_1.AdminStatsWsHandler,
            admin_mnemo_quiz_ws_handler_1.AdminMnemoQuizWsHandler,
            admin_ws_registrar_1.AdminWsRegistrar,
        ],
    }),
    __metadata("design:paramtypes", [admin_ws_registrar_1.AdminWsRegistrar])
], AdminModule);
//# sourceMappingURL=admin.module.js.map