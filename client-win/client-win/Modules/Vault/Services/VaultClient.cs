using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Network;
using client_win.Modules.User.Services;
using client_win.Modules.Vault.Models;

namespace client_win.Modules.Vault.Services;

public sealed class VaultClient : IVaultClient
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public VaultClient(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    private sealed class ListPayload
    {
        [JsonPropertyName("items")]
        public List<ItemDto>? Items { get; set; }
    }

    private sealed class ItemDto
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("roomName")]
        public string? RoomName { get; set; }

        [JsonPropertyName("gameType")]
        public string? GameType { get; set; }

        [JsonPropertyName("playersLabel")]
        public string? PlayersLabel { get; set; }

        [JsonPropertyName("createdAt")]
        public string? CreatedAt { get; set; }
    }

    private sealed class SavePayload
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }
    }

    private sealed class RestorePayload
    {
        [JsonPropertyName("roomId")]
        public int RoomId { get; set; }
    }

    private sealed class DeletePayload
    {
        [JsonPropertyName("ok")]
        public bool Ok { get; set; }
    }

    public async Task<IReadOnlyList<VaultSnapshotItem>> ListAsync(CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<ListPayload>(
                WsMessageTypes.Vault.List,
                payload: new { },
                token: token,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Impossible de lister le coffre fort.");
        }

        var items = res.Payload?.Items ?? new List<ItemDto>();
        return items
            .Select(i => new VaultSnapshotItem(
                Id: i.Id ?? string.Empty,
                Name: i.Name ?? string.Empty,
                RoomName: i.RoomName ?? string.Empty,
                GameType: i.GameType ?? string.Empty,
                PlayersLabel: i.PlayersLabel ?? string.Empty,
                CreatedAt: i.CreatedAt ?? string.Empty))
            .Where(i => !string.IsNullOrWhiteSpace(i.Id))
            .ToArray();
    }

    public async Task<string> SaveAsync(int roomId, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<SavePayload>(
                WsMessageTypes.Vault.Save,
                payload: new { roomId },
                token: token,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Sauvegarde impossible.");
        }

        var id = res.Payload?.Id ?? string.Empty;
        if (string.IsNullOrWhiteSpace(id))
        {
            throw new InvalidOperationException("Sauvegarde impossible (id manquant).");
        }
        return id;
    }

    public async Task<int> RestoreAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<RestorePayload>(
                WsMessageTypes.Vault.Restore,
                payload: new { id },
                token: token,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Restauration impossible.");
        }

        var roomId = res.Payload?.RoomId ?? 0;
        if (roomId <= 0)
        {
            throw new InvalidOperationException("Restauration impossible (roomId invalide).");
        }
        return roomId;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        var res = await _ws.RequestAsync<DeletePayload>(
                WsMessageTypes.Vault.Delete,
                payload: new { id },
                token: token,
                cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        if (!res.Success)
        {
            throw new InvalidOperationException(res.Error ?? "Suppression impossible.");
        }

        return res.Payload?.Ok ?? false;
    }
}

