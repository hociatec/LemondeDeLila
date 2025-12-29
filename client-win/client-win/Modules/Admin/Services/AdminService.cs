using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Admin.Services;

public sealed class AdminService : IAdminService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public AdminService(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<AdminUsersListResponseDto> ListUsersAsync(string? search = null, string? role = null, string? status = null, string? createdAfter = null, string? createdBefore = null, int page = 1, int limit = 20, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminUsersListResponseDto>(
            WsMessageTypes.Admin.UsersList,
            new { search, role, status, createdAfter, createdBefore, page, limit },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement utilisateurs impossible.");
        }
        return response.Payload;
    }

    public async Task BanUserAsync(int userId, string reason, int durationDays, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.UsersBan,
            new { id = userId, reason, durationDays },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Ban impossible.");
        }
    }

    public async Task UnbanUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.UsersUnban,
            new { id = userId },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Déban impossible.");
        }
    }

    public async Task DeleteUserAsync(int userId, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.UsersDelete,
            new { id = userId },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression impossible.");
        }
    }

    public async Task<AdminGamesListResponseDto> ListGamesAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminGamesListResponseDto>(
            WsMessageTypes.Admin.GamesList,
            payload: new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement jeux impossible.");
        }
        return response.Payload;
    }

    public async Task SetGameEnabledAsync(string gameType, bool enabled, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.GamesSetEnabled,
            new { gameType, enabled },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour jeu impossible.");
        }
    }

    public async Task UpdateGameAsync(
        string gameType,
        bool? enabled = null,
        int? minPlayers = null,
        int? maxPlayers = null,
        string? name = null,
        string? description = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.GamesUpdate,
            new { gameType, enabled, minPlayers, maxPlayers, name, description },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour jeu impossible.");
        }
    }

    public async Task ResetGameOverrideAsync(string gameType, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.GamesReset,
            new { gameType },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success)
        {
            throw new InvalidOperationException(response.Error ?? "Réinitialisation impossible.");
        }
    }

    public async Task<AdminGameCategoriesResponseDto> ListGameCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminGameCategoriesResponseDto>(
            WsMessageTypes.Admin.GamesCategories,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement des catégories impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminGameCategoriesResponseDto> CreateGameCategoryAsync(string name, string? parentId = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminGameCategoriesResponseDto>(
            WsMessageTypes.Admin.GameCategoryCreate,
            new { name, parentId },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Création catégorie impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminGameCategoriesResponseDto> UpdateGameCategoryAsync(string id, string? name = null, string? parentId = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new Dictionary<string, object?>
        {
            ["id"] = id,
        };
        if (!string.IsNullOrWhiteSpace(name))
        {
            payload["name"] = name;
        }
        if (parentId != null)
        {
            payload["parentId"] = parentId;
        }
        var response = await _ws.RequestAsync<AdminGameCategoriesResponseDto>(
            WsMessageTypes.Admin.GameCategoryUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour catégorie impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminGameCategoriesResponseDto> AssignGameCategoryAsync(string gameType, string? categoryId = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminGameCategoriesResponseDto>(
            WsMessageTypes.Admin.GameCategoryAssign,
            new { gameType, categoryId },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Assignation de catégorie impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotNamesListResponseDto> ListBotNamesAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotNamesListResponseDto>(
            WsMessageTypes.Admin.BotNamesList,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement des bots impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotSettingsDto> GetBotSettingsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotSettingsDto>(
            WsMessageTypes.Admin.BotSettingsGet,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement paramÃ¨tres bots impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotSettingsDto> UpdateBotSettingsAsync(int botTurnDelayMs, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotSettingsDto>(
            WsMessageTypes.Admin.BotSettingsUpdate,
            new { botTurnDelayMs },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise Ã  jour paramÃ¨tres bots impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotNamesListResponseDto> CreateBotNameAsync(string name, bool enabled = true, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotNamesListResponseDto>(
            WsMessageTypes.Admin.BotNameCreate,
            new { name, enabled },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "CrÃ©ation bot impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotNamesListResponseDto> UpdateBotNameAsync(int id, string? name = null, bool? enabled = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotNamesListResponseDto>(
            WsMessageTypes.Admin.BotNameUpdate,
            new { id, name, enabled },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise Ã  jour bot impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotNamesListResponseDto> DeleteBotNameAsync(int id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBotNamesListResponseDto>(
            WsMessageTypes.Admin.BotNameDelete,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression bot impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRolesListResponseDto> GetAvailableRolesAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRolesListResponseDto>(
            WsMessageTypes.Admin.RolesList,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement des rôles impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminUserDto> UpdateUserRolesAsync(int userId, IEnumerable<string> roles, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminUserResponseDto>(
            WsMessageTypes.Admin.UsersRoles,
            new { id = userId, roles = roles },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload?.User == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour des rôles impossible.");
        }
        return response.Payload.User;
    }

    public async Task<AdminRoleDefinitionsResponseDto> ListRoleDefinitionsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RolesDefinitionsList,
            payload: new { },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement des définitions impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> CreateRoleDefinitionAsync(string name, string description, IEnumerable<string> permissions, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionCreate,
            new { name, description, permissions = permissions ?? Array.Empty<string>() },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Création du rôle impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> UpdateRoleDefinitionAsync(string name, string? newName, string? description, IEnumerable<string>? permissions, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new Dictionary<string, object?>
        {
            ["name"] = name,
        };
        if (!string.IsNullOrWhiteSpace(newName))
        {
            payload["newName"] = newName;
        }
        if (!string.IsNullOrWhiteSpace(description))
        {
            payload["description"] = description;
        }
        if (permissions != null)
        {
            payload["permissions"] = permissions;
        }

        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour du rôle impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminRoleDefinitionsResponseDto> DeleteRoleDefinitionAsync(string name, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminRoleDefinitionsResponseDto>(
            WsMessageTypes.Admin.RoleDefinitionDelete,
            new { name },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression du rôle impossible.");
        }
        return response.Payload;
    }

    public async Task<int> BroadcastAsync(string message, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminBroadcastResponseDto>(
            WsMessageTypes.Admin.Broadcast,
            new { message },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Envoi impossible.");
        }
        return response.Payload.Delivered;
    }

    public async Task<AdminLogsDownloadResponseDto> DownloadLogsAsync(int lines = 200, string? filter = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminLogsDownloadResponseDto>(
            WsMessageTypes.Admin.LogsDownload,
            new { lines, filter },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Téléchargement des logs impossible.");
        }
        return response.Payload;
    }

    private string EnsureAuth()
    {
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Session non authentifiée.");
        }
        return token!;
    }
}
