using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService
{
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
        string? status = null,
        int? minPlayers = null,
        int? maxPlayers = null,
        string? name = null,
        string? description = null,
        string? rules = null,
        bool? chatEnabled = null,
        bool? chatSoundsEnabled = null,
        CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var payload = new Dictionary<string, object?>
        {
            ["gameType"] = gameType,
        };
        if (enabled.HasValue)
        {
            payload["enabled"] = enabled.Value;
        }
        if (status != null)
        {
            payload["status"] = status;
        }
        if (minPlayers.HasValue)
        {
            payload["minPlayers"] = minPlayers.Value;
        }
        if (maxPlayers.HasValue)
        {
            payload["maxPlayers"] = maxPlayers.Value;
        }
        if (name != null)
        {
            payload["name"] = name;
        }
        if (description != null)
        {
            payload["description"] = description;
        }
        if (rules != null)
        {
            payload["rules"] = rules;
        }
        if (chatEnabled.HasValue)
        {
            payload["chatEnabled"] = chatEnabled.Value;
        }
        if (chatSoundsEnabled.HasValue)
        {
            payload["chatSoundsEnabled"] = chatSoundsEnabled.Value;
        }
        var response = await _ws.RequestAsync<object>(
            WsMessageTypes.Admin.GamesUpdate,
            payload,
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

    public async Task<AdminGameCategoriesResponseDto> DeleteGameCategoryAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = EnsureAuth();
        var response = await _ws.RequestAsync<AdminGameCategoriesResponseDto>(
            WsMessageTypes.Admin.GameCategoryDelete,
            new { id },
            token,
            cancellationToken).ConfigureAwait(false);
        if (!response.Success || response.Payload == null)
        {
            throw new InvalidOperationException(response.Error ?? "Suppression de catégorie impossible.");
        }
        return response.Payload;
    }
}
