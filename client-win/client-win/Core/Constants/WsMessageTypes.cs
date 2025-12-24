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
        public const string SearchUser = "messaging.search";
    }

    /// <summary>
    /// Types de messages du catalogue
    /// </summary>
    public static class Catalog
    {
        public const string GetAll = "catalog.all";
        public const string GetCategory = "catalog.category";
        public const string GetGame = "catalog.game";
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
    }
}
