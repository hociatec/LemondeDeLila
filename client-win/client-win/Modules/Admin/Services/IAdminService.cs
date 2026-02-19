using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public interface IAdminService
{
    Task<AdminUsersListResponseDto> ListUsersAsync(
        string? search = null,
        string? role = null,
        string? status = null,
        string? createdAfter = null,
        string? createdBefore = null,
        int page = 1,
        int limit = 20,
        CancellationToken cancellationToken = default);
    Task BanUserAsync(int userId, string reason, int durationDays, CancellationToken cancellationToken = default);
    Task UnbanUserAsync(int userId, CancellationToken cancellationToken = default);
    Task DeleteUserAsync(int userId, CancellationToken cancellationToken = default);

    Task<AdminGamesListResponseDto> ListGamesAsync(CancellationToken cancellationToken = default);
    Task SetGameEnabledAsync(string gameType, bool enabled, CancellationToken cancellationToken = default);
    Task UpdateGameAsync(string gameType, bool? enabled = null, string? status = null, int? minPlayers = null, int? maxPlayers = null, string? name = null, string? description = null, string? rules = null, bool? chatEnabled = null, bool? chatSoundsEnabled = null, CancellationToken cancellationToken = default);
    Task ResetGameOverrideAsync(string gameType, CancellationToken cancellationToken = default);
    Task<AdminRolesListResponseDto> GetAvailableRolesAsync(CancellationToken cancellationToken = default);
    Task<AdminUserDto> UpdateUserRolesAsync(int userId, IEnumerable<string> roles, CancellationToken cancellationToken = default);

    Task<AdminLogsDownloadResponseDto> DownloadLogsAsync(int lines = 200, string? filter = null, CancellationToken cancellationToken = default);

    Task<int> BroadcastAsync(string message, CancellationToken cancellationToken = default);
    Task<(int delivered, int delaySeconds, string scheduledAt)> ScheduleClientUpdateAsync(int delayMinutes, string? message = null, CancellationToken cancellationToken = default);

    Task<AdminChatMessageDto[]> GetChatMessagesAsync(int limit = 200, bool includeDeleted = false, CancellationToken cancellationToken = default);
    Task<AdminChatSettingsDto> GetChatSettingsAsync(CancellationToken cancellationToken = default);
    Task<AdminChatSettingsDto> UpdateChatSettingsAsync(int chatHistoryLimit, int editWindowSeconds, CancellationToken cancellationToken = default);
    Task<bool> DeleteChatMessageAsync(string messageId, CancellationToken cancellationToken = default);
    Task<int> ClearChatAsync(CancellationToken cancellationToken = default);
    Task<AdminChatBanResponseDto> BanUserFromChatAsync(int userId, string? reason = null, int? durationDays = null, CancellationToken cancellationToken = default);
    Task<bool> UnbanUserFromChatAsync(int userId, CancellationToken cancellationToken = default);

    Task<AdminRoleDefinitionsResponseDto> ListRoleDefinitionsAsync(CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> CreateRoleDefinitionAsync(string name, string description, IEnumerable<string> permissions, CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> UpdateRoleDefinitionAsync(string name, string? newName, string? description, IEnumerable<string>? permissions, CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> DeleteRoleDefinitionAsync(string name, CancellationToken cancellationToken = default);

    Task<AdminGameCategoriesResponseDto> ListGameCategoriesAsync(CancellationToken cancellationToken = default);
    Task<AdminGameCategoriesResponseDto> CreateGameCategoryAsync(string name, string? parentId = null, CancellationToken cancellationToken = default);
    Task<AdminGameCategoriesResponseDto> UpdateGameCategoryAsync(string id, string? name = null, string? parentId = null, CancellationToken cancellationToken = default);
    Task<AdminGameCategoriesResponseDto> AssignGameCategoryAsync(string gameType, string? categoryId = null, CancellationToken cancellationToken = default);
    Task<AdminGameCategoriesResponseDto> DeleteGameCategoryAsync(string id, CancellationToken cancellationToken = default);

    Task<AdminMnemoQuizCategoriesResponseDto> GetMnemoQuizCategoriesAsync(CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizCategoriesResponseDto> CreateMnemoQuizCategoryAsync(string name, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizCategoriesResponseDto> UpdateMnemoQuizCategoryAsync(string id, string name, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizCategoriesResponseDto> DeleteMnemoQuizCategoryAsync(string id, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizQuestionsResponseDto> GetMnemoQuizQuestionsAsync(string? categoryId = null, string? status = null, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizQuestionsResponseDto> CreateMnemoQuizQuestionAsync(string categoryId, string question, IEnumerable<string> answers, int correctIndex = 0, string? status = null, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizQuestionsResponseDto> UpdateMnemoQuizQuestionAsync(string id, string? question = null, IEnumerable<string>? answers = null, int? correctIndex = null, string? status = null, CancellationToken cancellationToken = default);
    Task<AdminMnemoQuizQuestionsResponseDto> DeleteMnemoQuizQuestionAsync(string id, CancellationToken cancellationToken = default);

    Task<AdminBotNamesListResponseDto> ListBotNamesAsync(CancellationToken cancellationToken = default);
    Task<AdminBotNamesListResponseDto> CreateBotNameAsync(string name, bool enabled = true, CancellationToken cancellationToken = default);
    Task<AdminBotNamesListResponseDto> UpdateBotNameAsync(int id, string? name = null, bool? enabled = null, CancellationToken cancellationToken = default);
    Task<AdminBotNamesListResponseDto> DeleteBotNameAsync(int id, CancellationToken cancellationToken = default);
    Task<AdminBotSettingsDto> GetBotSettingsAsync(CancellationToken cancellationToken = default);
    Task<AdminBotSettingsDto> UpdateBotSettingsAsync(
        int? botTurnDelayMs = null,
        int? botStartDelayMs = null,
        int? botDrawDelayMs = null,
        CancellationToken cancellationToken = default);

    Task<AdminPerfSnapshotDto> GetPerfSnapshotAsync(int? windowSeconds = null, CancellationToken cancellationToken = default);

    Task<AdminRoomsCleanupResponseDto> CleanupRoomsAsync(
        bool includePrivate = false,
        bool includeStarted = false,
        int? olderThanMinutes = null,
        CancellationToken cancellationToken = default);

    Task<AdminRoomsListResponseDto> ListRoomsAsync(
        bool includePrivate = true,
        bool includeStarted = true,
        bool joinableOnly = false,
        int limit = 200,
        CancellationToken cancellationToken = default);

    Task<AdminRoomsDestroyResponseDto> DestroyRoomAsync(int roomId, CancellationToken cancellationToken = default);

    Task<AdminRoomMaintenanceSettingsDto> GetRoomMaintenanceSettingsAsync(CancellationToken cancellationToken = default);
    Task<AdminRoomMaintenanceSettingsDto> UpdateRoomMaintenanceSettingsAsync(
        bool? autoCleanupEnabled = null,
        int? autoCleanupOlderThanMinutes = null,
        int? autoCleanupIntervalSeconds = null,
        int? autoCleanupLimit = null,
        CancellationToken cancellationToken = default);

    Task<AdminProfileSettingsDto> GetProfileSettingsAsync(CancellationToken cancellationToken = default);
    Task<AdminProfileSettingsDto> UpdateProfileSettingsAsync(
        int? bioMinLength = null,
        int? bioMaxLength = null,
        CancellationToken cancellationToken = default);

    Task<AdminBugReportsListResponseDto> ListBugReportsAsync(CancellationToken cancellationToken = default);
    Task<AdminBugReportDto> CreateBugReportAsync(string subject, string content, CancellationToken cancellationToken = default);
    Task<AdminBugReportDto> GetBugReportAsync(string id, CancellationToken cancellationToken = default);
    Task<AdminBugReportDto> UpdateBugReportAsync(string id, string? subject = null, string? content = null, CancellationToken cancellationToken = default);
    Task<AdminBugReportDto> UpdateBugReportStatusAsync(string id, string status, CancellationToken cancellationToken = default);
    Task<bool> DeleteBugReportAsync(string id, CancellationToken cancellationToken = default);
    Task<AdminBugReportCommentsListResponseDto> ListBugReportCommentsAsync(string reportId, CancellationToken cancellationToken = default);
    Task<AdminBugReportCommentDto> AddBugReportCommentAsync(string reportId, string content, CancellationToken cancellationToken = default);

    Task ResetAllStoryBookAsync(CancellationToken cancellationToken = default);
}
