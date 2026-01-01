using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;
using System;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminRoomsCleanupResponseDto> CleanupRoomsAsync(
        bool includePrivate = false,
        bool includeStarted = false,
        int? olderThanMinutes = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomsCleanupResponseDto>(
            WsMessageTypes.Admin.RoomsCleanup,
            new
            {
                confirm = true,
                includePrivate,
                includeStarted,
                olderThanMinutes
            },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Nettoyage des rooms impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminRoomMaintenanceSettingsDto> GetRoomMaintenanceSettingsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomMaintenanceSettingsDto>(
            WsMessageTypes.Admin.RoomsSettingsGet,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Lecture des paramètres rooms impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminRoomMaintenanceSettingsDto> UpdateRoomMaintenanceSettingsAsync(
        bool? autoCleanupEnabled = null,
        int? autoCleanupOlderThanMinutes = null,
        int? autoCleanupIntervalSeconds = null,
        int? autoCleanupLimit = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomMaintenanceSettingsDto>(
            WsMessageTypes.Admin.RoomsSettingsUpdate,
            new
            {
                autoCleanupEnabled,
                autoCleanupOlderThanMinutes,
                autoCleanupIntervalSeconds,
                autoCleanupLimit
            },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Mise à jour des paramètres rooms impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminRoomsListResponseDto> ListRoomsAsync(
        bool includePrivate = true,
        bool includeStarted = true,
        bool joinableOnly = false,
        int limit = 200,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomsListResponseDto>(
            WsMessageTypes.Admin.RoomsList,
            new
            {
                includePrivate,
                includeStarted,
                joinableOnly,
                limit
            },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Liste des rooms impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminRoomsDestroyResponseDto> DestroyRoomAsync(int roomId, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminRoomsDestroyResponseDto>(
            WsMessageTypes.Admin.RoomsDestroy,
            new
            {
                confirm = true,
                roomId
            },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Suppression de la room impossible.");
        }

        return res.Payload;
    }
}
