"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminModule", {
    enumerable: true,
    get: function() {
        return AdminModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _userentity = require("../user/entities/user.entity");
const _adminusersservice = require("./services/admin-users.service");
const _roledefinitionsservice = require("./services/role-definitions.service");
const _adminuserscontroller = require("./controllers/admin-users.controller");
const _httpjwtguard = require("../common/guards/http-jwt.guard");
const _adminroleguard = require("../common/guards/admin-role.guard");
const _adminwsregistrar = require("./ws/admin-ws.registrar");
const _adminroomswshandler = require("./ws/admin-rooms-ws.handler");
const _adminchatwshandler = require("./ws/admin-chat-ws.handler");
const _adminuserswshandler = require("./ws/admin-users-ws.handler");
const _admingameswshandler = require("./ws/admin-games-ws.handler");
const _adminbotswshandler = require("./ws/admin-bots-ws.handler");
const _adminroleswshandler = require("./ws/admin-roles-ws.handler");
const _adminlogswshandler = require("./ws/admin-logs-ws.handler");
const _adminbroadcastwshandler = require("./ws/admin-broadcast-ws.handler");
const _adminclientupdateswshandler = require("./ws/admin-client-updates-ws.handler");
const _adminperfwshandler = require("./ws/admin-perf-ws.handler");
const _validationmodule = require("../common/validation/validation.module");
const _gameregistrymodule = require("../game/engine/game-registry.module");
const _notificationmodule = require("../notification/notification.module");
const _catalogmodule = require("../catalog/catalog.module");
const _botmodule = require("../bot/bot.module");
const _botmodule1 = require("../game/modules/bot/bot.module");
const _roledefinitionentity = require("./entities/role-definition.entity");
const _clientupdatesmodule = require("../client-updates/client-updates.module");
const _chatmodule = require("../chat/chat.module");
const _roommodule = require("../room/room.module");
const _admincataloginvalidationservice = require("./services/admin-catalog-invalidation.service");
const _socialmodule = require("../social/social.module");
const _adminprofilewshandler = require("./ws/admin-profile-ws.handler");
const _bugreportsmodule = require("../bug-reports/bug-reports.module");
const _adminbugreportswshandler = require("./ws/admin-bug-reports-ws.handler");
const _adminbugreportcommentswshandler = require("./ws/admin-bug-report-comments-ws.handler");
const _adminmaintenancecontroller = require("./controllers/admin-maintenance.controller");
const _adminmaintenanceguard = require("./guards/admin-maintenance.guard");
const _adminmaintenanceservice = require("./services/admin-maintenance.service");
const _statsmodule = require("../stats/stats.module");
const _adminstatswshandler = require("./ws/admin-stats-ws.handler");
const _archedemnemosynemodule = require("../game/games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.module");
const _adminmnemoquizwshandler = require("./ws/admin-mnemo-quiz-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminModule = class AdminModule {
    // Force eager instantiation of the WS registrar so its `onModuleInit()` runs and
    // admin WS message types get registered in the global `WsRouteRegistry`.
    constructor(wsRegistrar){
        this.wsRegistrar = wsRegistrar;
        void this.wsRegistrar;
    }
};
AdminModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _userentity.User,
                _roledefinitionentity.RoleDefinitionEntity
            ]),
            _validationmodule.ValidationModule,
            _gameregistrymodule.GameRegistryModule,
            _archedemnemosynemodule.ArcheDeMnemosyneModule,
            _notificationmodule.NotificationModule,
            _clientupdatesmodule.ClientUpdatesModule,
            _chatmodule.ChatModule,
            _catalogmodule.CatalogModule,
            _botmodule.BotModule,
            _botmodule1.BotModule,
            _roommodule.RoomModule,
            _socialmodule.SocialModule,
            _bugreportsmodule.BugReportsModule,
            _statsmodule.StatsModule
        ],
        controllers: [
            _adminuserscontroller.AdminUsersController,
            _adminmaintenancecontroller.AdminMaintenanceController
        ],
        providers: [
            _admincataloginvalidationservice.AdminCatalogInvalidationService,
            _adminusersservice.AdminUsersService,
            _roledefinitionsservice.RoleDefinitionsService,
            _httpjwtguard.HttpJwtGuard,
            _adminroleguard.AdminRoleGuard,
            _adminmaintenanceguard.AdminMaintenanceGuard,
            _adminmaintenanceservice.AdminMaintenanceService,
            _adminroomswshandler.AdminRoomsWsHandler,
            _adminchatwshandler.AdminChatWsHandler,
            _adminuserswshandler.AdminUsersWsHandler,
            _admingameswshandler.AdminGamesWsHandler,
            _adminbotswshandler.AdminBotsWsHandler,
            _adminroleswshandler.AdminRolesWsHandler,
            _adminlogswshandler.AdminLogsWsHandler,
            _adminbroadcastwshandler.AdminBroadcastWsHandler,
            _adminclientupdateswshandler.AdminClientUpdatesWsHandler,
            _adminperfwshandler.AdminPerfWsHandler,
            _adminprofilewshandler.AdminProfileWsHandler,
            _adminbugreportswshandler.AdminBugReportsWsHandler,
            _adminbugreportcommentswshandler.AdminBugReportCommentsWsHandler,
            _adminstatswshandler.AdminStatsWsHandler,
            _adminmnemoquizwshandler.AdminMnemoQuizWsHandler,
            _adminwsregistrar.AdminWsRegistrar
        ]
    }),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _adminwsregistrar.AdminWsRegistrar === "undefined" ? Object : _adminwsregistrar.AdminWsRegistrar
    ])
], AdminModule);
