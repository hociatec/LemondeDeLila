using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
    public async Task<AdminChatMessageDto[]> GetChatMessagesAsync(int limit = 200, bool includeDeleted = false, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminChatMessagesResponseDto>(
            WsMessageTypes.Admin.ChatMessages,
            new { limit, includeDeleted },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Chargement du tchat impossible.");
        }

        return response.Payload.Messages ?? Array.Empty<AdminChatMessageDto>();
    }

    public async Task<AdminChatSettingsDto> GetChatSettingsAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminChatSettingsDto>(
            WsMessageTypes.Admin.ChatSettingsGet,
            new { _noop = true },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Lecture des parametres tchat impossible.");
        }

        return res.Payload;
    }

    public async Task<AdminChatSettingsDto> UpdateChatSettingsAsync(int chatHistoryLimit, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var res = await _ws.RequestAsync<AdminChatSettingsDto>(
            WsMessageTypes.Admin.ChatSettingsUpdate,
            new { chatHistoryLimit },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!res.Success || res.Payload == null)
        {
            throw new InvalidOperationException(res.Error ?? "Mise a jour des parametres tchat impossible.");
        }

        return res.Payload;
    }

    public async Task<bool> DeleteChatMessageAsync(string messageId, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminChatDeleteResponseDto>(
            WsMessageTypes.Admin.ChatDelete,
            new { messageId },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression impossible.");
        }

        return response.Payload.Ok;
    }

    public async Task<int> ClearChatAsync(CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminChatClearResponseDto>(
            WsMessageTypes.Admin.ChatClear,
            new { _noop = true },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Réinitialisation impossible.");
        }

        return response.Payload.Deleted;
    }

    public async Task<AdminChatBanResponseDto> BanUserFromChatAsync(int userId, string? reason = null, int? durationDays = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminChatBanResponseDto>(
            WsMessageTypes.Admin.ChatBan,
            new { id = userId, reason, durationDays },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Ban tchat impossible.");
        }

        return response.Payload;
    }

    public async Task<bool> UnbanUserFromChatAsync(int userId, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminChatUnbanResponseDto>(
            WsMessageTypes.Admin.ChatUnban,
            new { id = userId, _noop = true },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Unban tchat impossible.");
        }

        return response.Payload.Ok;
    }
}

