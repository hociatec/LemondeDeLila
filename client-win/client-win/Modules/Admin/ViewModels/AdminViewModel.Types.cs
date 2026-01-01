namespace client_win.Modules.Admin.ViewModels;

public enum AdminNavResult
{
    Stay,
    Moved,
    Closed
}

internal enum AdminPage
{
    Root,
    Rooms,
    RoomsJoinSilent,
    Games,
    GameCategories,
    GameCategoryForm,
    GameCategoryAssign,
    GameActions,
    EditText,
    EditPlayers,
    Bots,
    BotNameActions,
    BotNameForm,
    BotSettingsForm,
    Roles,
    Users,
    UserActions,
    BanForm,
    UserChatBanForm,
    Chat,
    ChatDay,
    ChatMessageActions,
    ChatBanForm,
    Broadcast,
    ClientUpdates,
    Logs,
    RoleDefinitions,
    RoleDefinitionActions,
    RoleDefinitionForm,
    Perf,
    Sounds,
    SoundsTable,
    SoundsInvitations,
    SoundsChat,
    SoundsPrivateMessages,
    SoundDetails
}

public sealed record PermissionModuleDescriptor(string ModuleId, string DisplayName, string Description);
