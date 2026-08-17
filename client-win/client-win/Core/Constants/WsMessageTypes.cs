namespace client_win.Core.Constants;

/// <summary>
/// Constantes centralisées pour les types de messages WebSocket.
/// Ces valeurs doivent correspondre exactement aux types de messages définis dans l'API backend.
/// Utiliser ces constantes au lieu de chaînes codées en dur prévient les erreurs de frappe
/// et facilite la maintenance.
/// </summary>
public static class WsMessageTypes
{
    public const string Error = "error";
    public static class Api
    {
        public const string Capabilities = "api.capabilities";
    }

    /// <summary>
    /// Types de messages d'authentification
    /// </summary>
    public static class Auth
    {
        public const string Login = "auth.login";
        public const string Register = "auth.register";
        public const string Logout = "auth.logout";
        public const string ValidateSession = "auth.validate";
    }

    /// <summary>
    /// Types de messages de gestion des utilisateurs
    /// </summary>
    public static class Users
    {
        public const string Get = "users.get";
        public const string Update = "users.update";
        public const string Delete = "users.delete";
    }

    /// <summary>
    /// Types de messages de gestion d'une table/room
    /// </summary>
    public static class Room
    {
        public const string Leave = "room.leave";
        public const string Left = "room.left";
        public const string Deleted = "room.deleted";
        public const string Pong = "room.pong";
        public const string Ack = "room.ack";
        public const string Updated = "room.updated";
        public const string Created = "room.created";
        public const string Join = "room.join";
        public const string Ping = "room.ping";
        public const string Create = "room.create";

        public const string AddBot = "bot.add";
        public const string RemoveBot = "bot.remove";
        public const string TogglePrivacy = "room.toggle-privacy";
        public const string SetRole = "room.set-role";
        public const string Info = "room.info";
        public const string ChatHistory = "room.chat.history";
        public const string ChatSend = "room.chat.send";
        public const string Intent = "room.intent";
        public const string ChatMessage = "room.chat.message";
        public const string Privacy = "room.privacy";
        public const string Role = "room.role";
        public const string BotAdded = "bot.added";
        public const string BotRemoved = "bot.removed";
        public const string Start = "room.start";
        public const string Reset = "room.reset";
        public const string Ban = "room.ban";
        public const string Kick = "room.kick";
        public const string SetOwner = "room.set-owner";
        public const string SetAmbience = "room.set-ambience";
    }

    /// <summary>
    /// Types de messages du chat
    /// </summary>
    public static class Chat
    {
        public const string Error = "error";
        public const string Send = "chat-send";
        public const string Edit = "chat-edit";
        public const string Delete = "chat-delete";
        public const string Receive = "chat-receive";
        public const string Message = "chat-message";
        public const string MessageUpdated = "chat-message.updated";
        public const string MessageDeleted = "chat-message.deleted";
        public const string History = "chat-history";
    }

    /// <summary>
    /// Types de messages de la messagerie privée
    /// </summary>
    public static class Messaging
    {
        public const string Conversation = "messaging.conversation";
        public const string Messages = "messaging.messages";
        public const string Send = "messaging.send";
        public const string Message = "messaging.message";
        public const string Delete = "messaging.delete";
        public const string Restore = "messaging.restore";
        public const string Deleted = "messaging.deleted";
        public const string Restored = "messaging.restored";
        public const string Purge = "messaging.purge";
        public const string Purged = "messaging.purged";
        public const string SearchUser = "messaging.search";
        public const string MarkRead = "messaging.markRead";
    }

    /// <summary>
    /// Types de messages du catalogue
    /// </summary>
    public static class Catalog
    {
        /// <summary>
        /// Charge tout le catalogue (catégories + jeux).
        /// </summary>
        public const string All = "catalog.all";

        /// <summary>
        /// Charge uniquement la liste à plat des catégories.
        /// </summary>
        public const string Categories = "catalog.categories";

        /// <summary>
        /// Charge les jeux d'une catégorie spécifique.
        /// </summary>
        public const string CategoryGames = "catalog.categoryGames";

        /// <summary>
        /// Charge uniquement les jeux.
        /// </summary>
        public const string Games = "catalog.games";

        public const string Invalidate = "catalog.invalidate";

        // Alias pour compatibilité avec l'ancien nommage
        public const string GetAll = All;
    }

    /// <summary>
    /// Types de messages du module social
    /// </summary>
    public static class Social
    {
        public const string FriendsList = "social.friends.list";
        public const string FriendsRequests = "social.friends.requests";
        public const string FriendsBlocked = "social.friends.blocked";
        public const string FriendsRequest = "social.friends.request";
        public const string FriendRequested = "social.friend.requested";
        public const string FriendConnected = "social.friend.connected";
        public const string FriendDisconnected = "social.friend.disconnected";
        public const string FriendsAccept = "social.friends.accept";
        public const string FriendsReject = "social.friends.reject";
        public const string FriendsCancel = "social.friends.cancel";
        public const string FriendsRemove = "social.friends.remove";
        public const string FriendsBlock = "social.friends.block";
        public const string FriendsUnblock = "social.friends.unblock";
        public const string ProfileGet = "social.profile.get";
        public const string ProfileUpdate = "social.profile.update";
        public const string UserSearch = "social.user.search";
    }

    public static class Stats
    {
        public const string My = "stats.my";
        public const string User = "stats.user";
    }

    public static class Leaderboard
    {
        public const string Games = "leaderboard.games";
        public const string Top = "leaderboard.top";
    }

    public static class Admin
    {
        public const string UsersList = "admin.users.list";
        public const string UsersGet = "admin.users.get";
        public const string UsersBan = "admin.users.ban";
        public const string UsersUnban = "admin.users.unban";
        public const string UsersDelete = "admin.users.delete";
        public const string UsersRoles = "admin.users.roles";

        public const string GamesList = "admin.games.list";
        public const string GamesSetEnabled = "admin.games.setEnabled";
        public const string GamesUpdate = "admin.games.update";
        public const string GamesReset = "admin.games.reset";
        public const string GamesCategories = "admin.games.categories";
        public const string GameCategoryCreate = "admin.games.category.create";
        public const string GameCategoryUpdate = "admin.games.category.update";
        public const string GameCategoryAssign = "admin.games.category.assign";
        public const string GameCategoryDelete = "admin.games.category.delete";
        public const string RolesList = "admin.roles.list";
        public const string LogsDownload = "admin.logs.download";
        public const string RolesDefinitionsList = "admin.roles.definitions";
        public const string RoleDefinitionCreate = "admin.roles.create";
        public const string RoleDefinitionUpdate = "admin.roles.update";
        public const string RoleDefinitionDelete = "admin.roles.delete";

        public const string Broadcast = "admin.broadcast";
        public const string ClientUpdateAnnounce = "admin.client.update.announce";
        public const string ClientUpdateSchedule = "admin.client.update.schedule";

        public const string ChatMessages = "admin.chat.messages";
        public const string ChatSettingsGet = "admin.chat.settings.get";
        public const string ChatSettingsUpdate = "admin.chat.settings.update";
        public const string ChatDelete = "admin.chat.delete";
        public const string ChatClear = "admin.chat.clear";
        public const string ChatBan = "admin.chat.ban";
        public const string ChatUnban = "admin.chat.unban";

        public const string BotNamesList = "admin.bots.names.list";
        public const string BotSettingsGet = "admin.bots.settings.get";
        public const string BotSettingsUpdate = "admin.bots.settings.update";
        public const string BotNameCreate = "admin.bots.name.create";
        public const string BotNameUpdate = "admin.bots.name.update";
        public const string BotNameDelete = "admin.bots.name.delete";

        public const string PerfSnapshot = "admin.perf.snapshot";

        // Quiz (Arche de Mnemosyne)
        public const string MnemoQuizCategories = "admin.quiz.mnemo.categories";
        public const string MnemoQuizCategoryCreate = "admin.quiz.mnemo.category.create";
        public const string MnemoQuizCategoryUpdate = "admin.quiz.mnemo.category.update";
        public const string MnemoQuizCategoryDelete = "admin.quiz.mnemo.category.delete";
        public const string MnemoQuizQuestions = "admin.quiz.mnemo.questions";
        public const string MnemoQuizQuestionCreate = "admin.quiz.mnemo.question.create";
        public const string MnemoQuizQuestionUpdate = "admin.quiz.mnemo.question.update";
        public const string MnemoQuizQuestionDelete = "admin.quiz.mnemo.question.delete";

        public const string ProfileSettingsGet = "admin.profile.settings.get";
        public const string ProfileSettingsUpdate = "admin.profile.settings.update";

        public const string RoomsCleanup = "admin.rooms.cleanup";
        public const string RoomsList = "admin.rooms.list";
        public const string RoomsDestroy = "admin.rooms.destroy";
        public const string RoomsSettingsGet = "admin.rooms.settings.get";
        public const string RoomsSettingsUpdate = "admin.rooms.settings.update";

        public const string BugReportsCreate = "admin.bugReports.create";
        public const string BugReportsList = "admin.bugReports.list";
        public const string BugReportsGet = "admin.bugReports.get";
        public const string BugReportsUpdate = "admin.bugReports.update";
        public const string BugReportsUpdateStatus = "admin.bugReports.updateStatus";
        public const string BugReportsDelete = "admin.bugReports.delete";
        public const string BugReportsCommentsList = "admin.bugReports.comments.list";
        public const string BugReportsCommentsAdd = "admin.bugReports.comments.add";

        public const string StatsResetAll = "admin.stats.resetAll";
    }

    public static class Notify
    {
        public const string ClientHello = "client.hello";
        public const string Counts = "notify.counts";
        public const string CountsGet = "notify.counts.get";
        public const string Error = "notify.error";
        public const string InboxList = "notify.inbox.list";
        public const string InboxSnapshot = "notify.inbox.snapshot";
        public const string InboxItem = "notify.inbox.item";
        public const string InboxRemoved = "notify.inbox.removed";
        public const string InboxDelete = "notify.inbox.delete";
        public const string InboxMarkRead = "notify.inbox.markRead";
        public const string AdminContactSend = "notify.admin_contact.send";
        public const string AdminContactError = "notify.admin_contact.error";
        public const string AdminContactKind = "admin_contact";
        public const string AdminContactSent = "notify.admin_contact.sent";
        public const string AdminContactReply = "notify.admin_contact.reply";
        public const string AdminContactSetHandled = "notify.admin_contact.setHandled";
        public const string AdminContactSetStatus = "notify.admin_contact.setStatus";
        public const string AdminContactCycleStatus = "notify.admin_contact.cycleStatus";
        public const string AdminContactThreads = "notify.admin_contact.threads";
        public const string AdminContactDeleteThread = "notify.admin_contact.deleteThread";
        public const string ClientUpdateAvailable = "client.update.available";
        public const string ClientUpdateImminent = "client.update.imminent";
        public const string ClientUpdateRequired = "client.update.required";
    }

    public static class Rooms
    {
        // Canonical lobby routes
        public const string InviteSend = "room.lobby.invite.send";
        public const string InvitePresenceList = "room.lobby.invite.presence.list";
        public const string InviteRespond = "room.lobby.invite.respond";
        public const string PublicList = "room.lobby.list";
        public const string PublicSubscribe = "room.lobby.subscribe";
        public const string PublicUnsubscribe = "room.lobby.unsubscribe";

        public const string EventInviteReceived = "rooms.invite.received";
        public const string EventInviteAccepted = "rooms.invite.accepted";
        public const string EventInviteResponded = "rooms.invite.responded";
        public const string EventPublicRefresh = "rooms.public.refresh";
        public const string EventRestoreReady = "rooms.restore.ready";
        public const string EventLobbyInviteReceived = "room.lobby.invite.received";
        public const string EventLobbyInviteAccepted = "room.lobby.invite.accepted";
        public const string EventLobbyInviteResponded = "room.lobby.invite.responded";
        public const string EventLobbyRefresh = "room.lobby.refresh";

        // Backward compatibility
        public const string LegacyInviteSend = "rooms.invite.send";
        public const string LegacyInvitePresenceList = "rooms.invite.presence.list";
        public const string LegacyInviteRespond = "rooms.invite.respond";
        public const string LegacyPublicList = "rooms.public.list";
        public const string LegacyPublicSubscribe = "rooms.public.subscribe";
        public const string LegacyPublicUnsubscribe = "rooms.public.unsubscribe";
    }

    public static class Sound
    {
        public const string Updated = "sounds.updated";
        public const string TableAmbiencesUpdated = "sounds.tableAmbiences.updated";
    }

    public static class Vault
    {
        public const string List = "vault.list";
        public const string Save = "vault.save";
        public const string Restore = "vault.restore";
        public const string Delete = "vault.delete";
        public const string Abandon = "vault.abandon";
    }

    /// <summary>
    /// Contextes d'erreur pour ErrorBus (identification de la source de l'erreur)
    /// </summary>
    public static class ErrorContext
    {
        public const string AuthLogin = "auth.login";
        public const string AuthRegister = "auth.register";
        public const string WsConnect = "ws.connect";
        public const string WsReceive = "ws.receive";
        public const string HomeLogin = "home.login";
        public const string HomeRegister = "home.register";
        public const string CatalogAll = "catalog.all";
        public const string ChatSend = "chat.send";
        public const string Messaging = "messaging";
        public const string Social = "social";
        public const string Stats = "stats";
        public const string Leaderboard = "leaderboard";
        public const string Admin = "admin";
    }
}






