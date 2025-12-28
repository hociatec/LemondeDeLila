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
    Task UpdateGameAsync(string gameType, bool? enabled = null, int? minPlayers = null, int? maxPlayers = null, string? name = null, string? description = null, CancellationToken cancellationToken = default);
    Task ResetGameOverrideAsync(string gameType, CancellationToken cancellationToken = default);
    Task<AdminRolesListResponseDto> GetAvailableRolesAsync(CancellationToken cancellationToken = default);
    Task<AdminUserDto> UpdateUserRolesAsync(int userId, IEnumerable<string> roles, CancellationToken cancellationToken = default);

    Task<AdminLogsDownloadResponseDto> DownloadLogsAsync(int lines = 200, string? filter = null, CancellationToken cancellationToken = default);

    Task<int> BroadcastAsync(string message, CancellationToken cancellationToken = default);

    Task<AdminRoleDefinitionsResponseDto> ListRoleDefinitionsAsync(CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> CreateRoleDefinitionAsync(string name, string description, IEnumerable<string> permissions, CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> UpdateRoleDefinitionAsync(string name, string? newName, string? description, IEnumerable<string>? permissions, CancellationToken cancellationToken = default);
    Task<AdminRoleDefinitionsResponseDto> DeleteRoleDefinitionAsync(string name, CancellationToken cancellationToken = default);
}
