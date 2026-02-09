using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
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
            throw new InvalidOperationException(response.Error ?? "Chargement paramètres bots impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotSettingsDto> UpdateBotSettingsAsync(
        int? botTurnDelayMs = null,
        int? botStartDelayMs = null,
        int? botDrawDelayMs = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new System.Collections.Generic.Dictionary<string, object?>();
        if (botTurnDelayMs.HasValue)
        {
            payload["botTurnDelayMs"] = botTurnDelayMs.Value;
        }
        if (botStartDelayMs.HasValue)
        {
            payload["botStartDelayMs"] = botStartDelayMs.Value;
        }
        if (botDrawDelayMs.HasValue)
        {
            payload["botDrawDelayMs"] = botDrawDelayMs.Value;
        }

        var response = await _ws.RequestAsync<AdminBotSettingsDto>(
            WsMessageTypes.Admin.BotSettingsUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour paramètres bots impossible.");
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
            throw new InvalidOperationException(response.Error ?? "Création bot impossible.");
        }
        return response.Payload;
    }

    public async Task<AdminBotNamesListResponseDto> UpdateBotNameAsync(int id, string? name = null, bool? enabled = null, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new System.Collections.Generic.Dictionary<string, object?>
        {
            ["id"] = id
        };
        if (name != null)
        {
            payload["name"] = name;
        }
        if (enabled != null)
        {
            payload["enabled"] = enabled;
        }
        var response = await _ws.RequestAsync<AdminBotNamesListResponseDto>(
            WsMessageTypes.Admin.BotNameUpdate,
            payload,
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Mise à jour bot impossible.");
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
}
