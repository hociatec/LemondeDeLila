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
exports.AdminWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const admin_rooms_ws_handler_1 = require("./admin-rooms-ws.handler");
const admin_chat_ws_handler_1 = require("./admin-chat-ws.handler");
const admin_users_ws_handler_1 = require("./admin-users-ws.handler");
const admin_games_ws_handler_1 = require("./admin-games-ws.handler");
const admin_bots_ws_handler_1 = require("./admin-bots-ws.handler");
const admin_roles_ws_handler_1 = require("./admin-roles-ws.handler");
const admin_logs_ws_handler_1 = require("./admin-logs-ws.handler");
const admin_broadcast_ws_handler_1 = require("./admin-broadcast-ws.handler");
const admin_client_updates_ws_handler_1 = require("./admin-client-updates-ws.handler");
const admin_perf_ws_handler_1 = require("./admin-perf-ws.handler");
const admin_profile_ws_handler_1 = require("./admin-profile-ws.handler");
const admin_bug_reports_ws_handler_1 = require("./admin-bug-reports-ws.handler");
const admin_bug_report_comments_ws_handler_1 = require("./admin-bug-report-comments-ws.handler");
const admin_stats_ws_handler_1 = require("./admin-stats-ws.handler");
const admin_mnemo_quiz_ws_handler_1 = require("./admin-mnemo-quiz-ws.handler");
let AdminWsRegistrar = class AdminWsRegistrar {
    registry;
    rooms;
    chat;
    users;
    games;
    bots;
    roles;
    logs;
    broadcast;
    clientUpdates;
    perf;
    profile;
    bugReports;
    bugReportComments;
    stats;
    mnemoQuiz;
    constructor(registry, rooms, chat, users, games, bots, roles, logs, broadcast, clientUpdates, perf, profile, bugReports, bugReportComments, stats, mnemoQuiz) {
        this.registry = registry;
        this.rooms = rooms;
        this.chat = chat;
        this.users = users;
        this.games = games;
        this.bots = bots;
        this.roles = roles;
        this.logs = logs;
        this.broadcast = broadcast;
        this.clientUpdates = clientUpdates;
        this.perf = perf;
        this.profile = profile;
        this.bugReports = bugReports;
        this.bugReportComments = bugReportComments;
        this.stats = stats;
        this.mnemoQuiz = mnemoQuiz;
    }
    onModuleInit() {
        this.registry.register('admin.users.list', (s, p) => this.users.usersList(s, p));
        this.registry.register('admin.users.get', (s, p) => this.users.usersGet(s, p));
        this.registry.register('admin.users.ban', (s, p) => this.users.usersBan(s, p));
        this.registry.register('admin.users.unban', (s, p) => this.users.usersUnban(s, p));
        this.registry.register('admin.users.delete', (s, p) => this.users.usersDelete(s, p));
        this.registry.register('admin.games.list', (s) => this.games.gamesList(s));
        this.registry.register('admin.games.setEnabled', (s, p) => this.games.gamesSetEnabled(s, p));
        this.registry.register('admin.games.update', (s, p) => this.games.gamesUpdate(s, p));
        this.registry.register('admin.games.reset', (s, p) => this.games.gamesReset(s, p));
        this.registry.register('admin.games.categories', (s, p) => Promise.resolve(this.games.gamesCategoriesList(s, p)));
        this.registry.register('admin.games.category.create', (s, p) => this.games.gamesCategoryCreate(s, p));
        this.registry.register('admin.games.category.update', (s, p) => this.games.gamesCategoryUpdate(s, p));
        this.registry.register('admin.games.category.assign', (s, p) => this.games.gamesCategoryAssign(s, p));
        this.registry.register('admin.games.category.delete', (s, p) => this.games.gamesCategoryDelete(s, p));
        this.registry.register('admin.roles.list', (s, p) => this.roles.rolesList(s, p));
        this.registry.register('admin.users.roles', (s, p) => this.users.usersUpdateRoles(s, p));
        this.registry.register('admin.roles.definitions', (s) => this.roles.rolesDefinitionsList(s));
        this.registry.register('admin.roles.create', (s, p) => this.roles.roleDefinitionCreate(s, p));
        this.registry.register('admin.roles.update', (s, p) => this.roles.roleDefinitionUpdate(s, p));
        this.registry.register('admin.roles.delete', (s, p) => this.roles.roleDefinitionDelete(s, p));
        this.registry.register('admin.logs.download', (s, p) => this.logs.logsDownload(s, p));
        this.registry.register('admin.broadcast', (s, p) => this.broadcast.broadcast(s, p));
        this.registry.register('admin.client.update.announce', (s, p) => this.clientUpdates.clientUpdateAnnounce(s, p));
        this.registry.register('admin.client.update.forceLatest', (s, p) => this.clientUpdates.clientUpdateForceLatest(s, p));
        this.registry.register('admin.client.update.schedule', (s, p) => this.clientUpdates.clientUpdateSchedule(s, p));
        this.registry.register('admin.chat.messages', (s, p) => this.chat.chatMessages(s, p));
        this.registry.register('admin.chat.settings.get', (s, p) => Promise.resolve(this.chat.chatSettingsGet(s, p)));
        this.registry.register('admin.chat.settings.update', (s, p) => this.chat.chatSettingsUpdate(s, p));
        this.registry.register('admin.quiz.mnemo.categories', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoCategories(s, p)));
        this.registry.register('admin.quiz.mnemo.category.create', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoCategoryCreate(s, p)));
        this.registry.register('admin.quiz.mnemo.category.update', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoCategoryUpdate(s, p)));
        this.registry.register('admin.quiz.mnemo.category.delete', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoCategoryDelete(s, p)));
        this.registry.register('admin.quiz.mnemo.questions', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoQuestions(s, p)));
        this.registry.register('admin.quiz.mnemo.question.create', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoQuestionCreate(s, p)));
        this.registry.register('admin.quiz.mnemo.question.update', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoQuestionUpdate(s, p)));
        this.registry.register('admin.quiz.mnemo.question.delete', (s, p) => Promise.resolve(this.mnemoQuiz.mnemoQuestionDelete(s, p)));
        this.registry.register('admin.chat.delete', (s, p) => this.chat.chatDelete(s, p));
        this.registry.register('admin.chat.clear', (s, p) => this.chat.chatClear(s, p));
        this.registry.register('admin.chat.ban', (s, p) => this.chat.chatBan(s, p));
        this.registry.register('admin.chat.unban', (s, p) => this.chat.chatUnban(s, p));
        this.registry.register('admin.profile.settings.get', (s, p) => Promise.resolve(this.profile.profileSettingsGet(s, p)));
        this.registry.register('admin.profile.settings.update', (s, p) => this.profile.profileSettingsUpdate(s, p));
        this.registry.register('admin.stats.resetAll', (s) => this.stats.statsResetAll(s));
        this.registry.register('admin.bugReports.create', (s, p) => this.bugReports.create(s, p));
        this.registry.register('admin.bugReports.list', (s, p) => this.bugReports.list(s, p));
        this.registry.register('admin.bugReports.get', (s, p) => this.bugReports.get(s, p));
        this.registry.register('admin.bugReports.update', (s, p) => this.bugReports.update(s, p));
        this.registry.register('admin.bugReports.updateStatus', (s, p) => this.bugReports.updateStatus(s, p));
        this.registry.register('admin.bugReports.delete', (s, p) => this.bugReports.delete(s, p));
        this.registry.register('admin.bugReports.comments.list', (s, p) => this.bugReportComments.list(s, p));
        this.registry.register('admin.bugReports.comments.add', (s, p) => this.bugReportComments.add(s, p));
        this.registry.register('admin.bots.names.list', (s, p) => this.bots.botsNamesList(s, p));
        this.registry.register('admin.bots.settings.get', (s, p) => Promise.resolve(this.bots.botSettingsGet(s, p)));
        this.registry.register('admin.bots.settings.update', (s, p) => this.bots.botSettingsUpdate(s, p));
        this.registry.register('admin.bots.name.create', (s, p) => this.bots.botNameCreate(s, p));
        this.registry.register('admin.bots.name.update', (s, p) => this.bots.botNameUpdate(s, p));
        this.registry.register('admin.bots.name.delete', (s, p) => this.bots.botNameDelete(s, p));
        this.registry.register('admin.perf.snapshot', (s, p) => Promise.resolve(this.perf.perfSnapshot(s, p)));
        this.registry.register('admin.rooms.cleanup', (s, p) => this.rooms.roomsCleanup(s, p));
        this.registry.register('admin.rooms.list', (s, p) => this.rooms.roomsList(s, p));
        this.registry.register('admin.rooms.destroy', (s, p) => this.rooms.roomsDestroy(s, p));
        this.registry.register('admin.rooms.settings.get', (s, p) => Promise.resolve(this.rooms.roomsSettingsGet(s, p)));
        this.registry.register('admin.rooms.settings.update', (s, p) => this.rooms.roomsSettingsUpdate(s, p));
    }
};
exports.AdminWsRegistrar = AdminWsRegistrar;
exports.AdminWsRegistrar = AdminWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
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
        admin_mnemo_quiz_ws_handler_1.AdminMnemoQuizWsHandler])
], AdminWsRegistrar);
//# sourceMappingURL=admin-ws.registrar.js.map