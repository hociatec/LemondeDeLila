"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AdminWsRegistrar", {
    enumerable: true,
    get: function() {
        return AdminWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _adminroomswshandler = require("./admin-rooms-ws.handler");
const _adminchatwshandler = require("./admin-chat-ws.handler");
const _adminuserswshandler = require("./admin-users-ws.handler");
const _admingameswshandler = require("./admin-games-ws.handler");
const _adminbotswshandler = require("./admin-bots-ws.handler");
const _adminroleswshandler = require("./admin-roles-ws.handler");
const _adminlogswshandler = require("./admin-logs-ws.handler");
const _adminbroadcastwshandler = require("./admin-broadcast-ws.handler");
const _adminclientupdateswshandler = require("./admin-client-updates-ws.handler");
const _adminperfwshandler = require("./admin-perf-ws.handler");
const _adminprofilewshandler = require("./admin-profile-ws.handler");
const _adminbugreportswshandler = require("./admin-bug-reports-ws.handler");
const _adminbugreportcommentswshandler = require("./admin-bug-report-comments-ws.handler");
const _adminstatswshandler = require("./admin-stats-ws.handler");
const _adminmnemoquizwshandler = require("./admin-mnemo-quiz-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AdminWsRegistrar = class AdminWsRegistrar {
    onModuleInit() {
        this.registry.register('admin.users.list', (s, p)=>this.users.usersList(s, p));
        this.registry.register('admin.users.get', (s, p)=>this.users.usersGet(s, p));
        this.registry.register('admin.users.ban', (s, p)=>this.users.usersBan(s, p));
        this.registry.register('admin.users.unban', (s, p)=>this.users.usersUnban(s, p));
        this.registry.register('admin.users.delete', (s, p)=>this.users.usersDelete(s, p));
        this.registry.register('admin.games.list', (s)=>this.games.gamesList(s));
        this.registry.register('admin.games.setEnabled', (s, p)=>this.games.gamesSetEnabled(s, p));
        this.registry.register('admin.games.update', (s, p)=>this.games.gamesUpdate(s, p));
        this.registry.register('admin.games.reset', (s, p)=>this.games.gamesReset(s, p));
        this.registry.register('admin.games.categories', (s, p)=>Promise.resolve(this.games.gamesCategoriesList(s, p)));
        this.registry.register('admin.games.category.create', (s, p)=>this.games.gamesCategoryCreate(s, p));
        this.registry.register('admin.games.category.update', (s, p)=>this.games.gamesCategoryUpdate(s, p));
        this.registry.register('admin.games.category.assign', (s, p)=>this.games.gamesCategoryAssign(s, p));
        this.registry.register('admin.games.category.delete', (s, p)=>this.games.gamesCategoryDelete(s, p));
        this.registry.register('admin.roles.list', (s, p)=>this.roles.rolesList(s, p));
        this.registry.register('admin.users.roles', (s, p)=>this.users.usersUpdateRoles(s, p));
        this.registry.register('admin.roles.definitions', (s)=>this.roles.rolesDefinitionsList(s));
        this.registry.register('admin.roles.create', (s, p)=>this.roles.roleDefinitionCreate(s, p));
        this.registry.register('admin.roles.update', (s, p)=>this.roles.roleDefinitionUpdate(s, p));
        this.registry.register('admin.roles.delete', (s, p)=>this.roles.roleDefinitionDelete(s, p));
        this.registry.register('admin.logs.download', (s, p)=>this.logs.logsDownload(s, p));
        this.registry.register('admin.broadcast', (s, p)=>this.broadcast.broadcast(s, p));
        this.registry.register('admin.client.update.announce', (s, p)=>this.clientUpdates.clientUpdateAnnounce(s, p));
        this.registry.register('admin.client.update.forceLatest', (s, p)=>this.clientUpdates.clientUpdateForceLatest(s, p));
        this.registry.register('admin.client.update.schedule', (s, p)=>this.clientUpdates.clientUpdateSchedule(s, p));
        this.registry.register('admin.chat.messages', (s, p)=>this.chat.chatMessages(s, p));
        this.registry.register('admin.chat.settings.get', (s, p)=>Promise.resolve(this.chat.chatSettingsGet(s, p)));
        this.registry.register('admin.chat.settings.update', (s, p)=>this.chat.chatSettingsUpdate(s, p));
        // Quiz (Arche de Mnémosyne)
        this.registry.register('admin.quiz.mnemo.categories', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoCategories(s, p)));
        this.registry.register('admin.quiz.mnemo.category.create', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoCategoryCreate(s, p)));
        this.registry.register('admin.quiz.mnemo.category.update', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoCategoryUpdate(s, p)));
        this.registry.register('admin.quiz.mnemo.category.delete', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoCategoryDelete(s, p)));
        this.registry.register('admin.quiz.mnemo.questions', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoQuestions(s, p)));
        this.registry.register('admin.quiz.mnemo.question.create', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoQuestionCreate(s, p)));
        this.registry.register('admin.quiz.mnemo.question.update', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoQuestionUpdate(s, p)));
        this.registry.register('admin.quiz.mnemo.question.delete', (s, p)=>Promise.resolve(this.mnemoQuiz.mnemoQuestionDelete(s, p)));
        this.registry.register('admin.chat.delete', (s, p)=>this.chat.chatDelete(s, p));
        this.registry.register('admin.chat.clear', (s, p)=>this.chat.chatClear(s, p));
        this.registry.register('admin.chat.ban', (s, p)=>this.chat.chatBan(s, p));
        this.registry.register('admin.chat.unban', (s, p)=>this.chat.chatUnban(s, p));
        this.registry.register('admin.profile.settings.get', (s, p)=>Promise.resolve(this.profile.profileSettingsGet(s, p)));
        this.registry.register('admin.profile.settings.update', (s, p)=>this.profile.profileSettingsUpdate(s, p));
        this.registry.register('admin.stats.resetAll', (s)=>this.stats.statsResetAll(s));
        this.registry.register('admin.bugReports.create', (s, p)=>this.bugReports.create(s, p));
        this.registry.register('admin.bugReports.list', (s, p)=>this.bugReports.list(s, p));
        this.registry.register('admin.bugReports.get', (s, p)=>this.bugReports.get(s, p));
        this.registry.register('admin.bugReports.update', (s, p)=>this.bugReports.update(s, p));
        this.registry.register('admin.bugReports.updateStatus', (s, p)=>this.bugReports.updateStatus(s, p));
        this.registry.register('admin.bugReports.delete', (s, p)=>this.bugReports.delete(s, p));
        this.registry.register('admin.bugReports.comments.list', (s, p)=>this.bugReportComments.list(s, p));
        this.registry.register('admin.bugReports.comments.add', (s, p)=>this.bugReportComments.add(s, p));
        this.registry.register('admin.bots.names.list', (s, p)=>this.bots.botsNamesList(s, p));
        this.registry.register('admin.bots.settings.get', (s, p)=>Promise.resolve(this.bots.botSettingsGet(s, p)));
        this.registry.register('admin.bots.settings.update', (s, p)=>this.bots.botSettingsUpdate(s, p));
        this.registry.register('admin.bots.name.create', (s, p)=>this.bots.botNameCreate(s, p));
        this.registry.register('admin.bots.name.update', (s, p)=>this.bots.botNameUpdate(s, p));
        this.registry.register('admin.bots.name.delete', (s, p)=>this.bots.botNameDelete(s, p));
        this.registry.register('admin.perf.snapshot', (s, p)=>Promise.resolve(this.perf.perfSnapshot(s, p)));
        this.registry.register('admin.rooms.cleanup', (s, p)=>this.rooms.roomsCleanup(s, p));
        this.registry.register('admin.rooms.list', (s, p)=>this.rooms.roomsList(s, p));
        this.registry.register('admin.rooms.destroy', (s, p)=>this.rooms.roomsDestroy(s, p));
        this.registry.register('admin.rooms.settings.get', (s, p)=>Promise.resolve(this.rooms.roomsSettingsGet(s, p)));
        this.registry.register('admin.rooms.settings.update', (s, p)=>this.rooms.roomsSettingsUpdate(s, p));
    }
    constructor(registry, rooms, chat, users, games, bots, roles, logs, broadcast, clientUpdates, perf, profile, bugReports, bugReportComments, stats, mnemoQuiz){
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
};
AdminWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _adminroomswshandler.AdminRoomsWsHandler === "undefined" ? Object : _adminroomswshandler.AdminRoomsWsHandler,
        typeof _adminchatwshandler.AdminChatWsHandler === "undefined" ? Object : _adminchatwshandler.AdminChatWsHandler,
        typeof _adminuserswshandler.AdminUsersWsHandler === "undefined" ? Object : _adminuserswshandler.AdminUsersWsHandler,
        typeof _admingameswshandler.AdminGamesWsHandler === "undefined" ? Object : _admingameswshandler.AdminGamesWsHandler,
        typeof _adminbotswshandler.AdminBotsWsHandler === "undefined" ? Object : _adminbotswshandler.AdminBotsWsHandler,
        typeof _adminroleswshandler.AdminRolesWsHandler === "undefined" ? Object : _adminroleswshandler.AdminRolesWsHandler,
        typeof _adminlogswshandler.AdminLogsWsHandler === "undefined" ? Object : _adminlogswshandler.AdminLogsWsHandler,
        typeof _adminbroadcastwshandler.AdminBroadcastWsHandler === "undefined" ? Object : _adminbroadcastwshandler.AdminBroadcastWsHandler,
        typeof _adminclientupdateswshandler.AdminClientUpdatesWsHandler === "undefined" ? Object : _adminclientupdateswshandler.AdminClientUpdatesWsHandler,
        typeof _adminperfwshandler.AdminPerfWsHandler === "undefined" ? Object : _adminperfwshandler.AdminPerfWsHandler,
        typeof _adminprofilewshandler.AdminProfileWsHandler === "undefined" ? Object : _adminprofilewshandler.AdminProfileWsHandler,
        typeof _adminbugreportswshandler.AdminBugReportsWsHandler === "undefined" ? Object : _adminbugreportswshandler.AdminBugReportsWsHandler,
        typeof _adminbugreportcommentswshandler.AdminBugReportCommentsWsHandler === "undefined" ? Object : _adminbugreportcommentswshandler.AdminBugReportCommentsWsHandler,
        typeof _adminstatswshandler.AdminStatsWsHandler === "undefined" ? Object : _adminstatswshandler.AdminStatsWsHandler,
        typeof _adminmnemoquizwshandler.AdminMnemoQuizWsHandler === "undefined" ? Object : _adminmnemoquizwshandler.AdminMnemoQuizWsHandler
    ])
], AdminWsRegistrar);
