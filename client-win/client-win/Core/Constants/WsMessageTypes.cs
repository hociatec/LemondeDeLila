namespace client_win.Core.Constants;

/// <summary>
/// Constantes centralisées pour les types de messages WebSocket.
/// Ces valeurs doivent correspondre exactement aux types de messages définis dans l'API backend.
/// Utiliser ces constantes au lieu de chaînes codées en dur prévient les erreurs de frappe
/// et facilite la maintenance.
/// </summary>
public static class WsMessageTypes
{
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
    /// Types de messages du chat
    /// </summary>
    public static class Chat
    {
        public const string Send = "chat-send";
        public const string Receive = "chat-receive";
        public const string Message = "chat-message";
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
        public const string RolesList = "admin.roles.list";
        public const string LogsDownload = "admin.logs.download";
        public const string RolesDefinitionsList = "admin.roles.definitions";
        public const string RoleDefinitionCreate = "admin.roles.create";
        public const string RoleDefinitionUpdate = "admin.roles.update";
        public const string RoleDefinitionDelete = "admin.roles.delete";

        public const string Broadcast = "admin.broadcast";
        public const string ClientUpdateAnnounce = "admin.client.update.announce";
        public const string ClientUpdateForceLatest = "admin.client.update.forceLatest";

        public const string ChatMessages = "admin.chat.messages";
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

        public const string RoomsCleanup = "admin.rooms.cleanup";
        public const string RoomsList = "admin.rooms.list";
        public const string RoomsDestroy = "admin.rooms.destroy";
        public const string RoomsSettingsGet = "admin.rooms.settings.get";
        public const string RoomsSettingsUpdate = "admin.rooms.settings.update";
    }

    public static class Rooms
    {
        public const string InviteSend = "rooms.invite.send";
        public const string InviteRespond = "rooms.invite.respond";
        public const string PublicList = "rooms.public.list";
        public const string PublicSubscribe = "rooms.public.subscribe";
        public const string PublicUnsubscribe = "rooms.public.unsubscribe";
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
