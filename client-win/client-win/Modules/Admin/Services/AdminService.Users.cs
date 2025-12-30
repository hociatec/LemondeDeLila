using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
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
}

