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
    Maintenance,
    MaintenanceBackend,
    MaintenanceSystemd,
    Rooms,
    RoomsJoinSilent,
    RoomsDestroy,
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
    UsersProfile,
    UsersProfileBioSettings,
    Chat,
    ChatDay,
    ChatMessageActions,
    ChatBanForm,
    ChatSettings,
    Broadcast,
    ClientUpdates,
    Logs,
    RoleDefinitions,
    RoleDefinitionActions,
    RoleDefinitionForm,
    Perf,
    Sounds,
    SoundsAmbience,
    SoundsTable,
    SoundsInvitations,
    SoundsConnection,
    SoundsChat,
    SoundsPrivateMessages,
    SoundsAdminContact,
    SoundDetails,
    BugReports,
    BugReportsStatusReports,
    BugReportCreate,
    BugReportDetails,
    BugReportEdit,
    BugReportConsult,
    BugReportComments,
    BugReportCommentCreate
}

public sealed record PermissionModuleDescriptor(string ModuleId, string DisplayName, string Description);
