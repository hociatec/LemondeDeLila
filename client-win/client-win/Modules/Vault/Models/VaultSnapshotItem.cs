using System;

namespace client_win.Modules.Vault.Models;

public sealed record VaultSnapshotItem(
    string Id,
    string Name,
    string RoomName,
    string GameType,
    string PlayersLabel,
    string CreatedAt)
{
    public string DisplayLabel
    {
        get
        {
            var name = (Name ?? string.Empty).Trim();
            var players = (PlayersLabel ?? string.Empty).Trim();
            var date = FormatCreatedAt(CreatedAt);

            if (!string.IsNullOrWhiteSpace(players))
            {
                return $"{name} avec {players}, {date}";
            }

            return $"{name}, {date}";
        }
    }

    public override string ToString() => DisplayLabel;

    private static string FormatCreatedAt(string? raw)
    {
        var createdAt = (raw ?? string.Empty).Trim();
        if (DateTimeOffset.TryParse(createdAt, out var dto))
        {
            return dto.ToLocalTime().ToString("dd.MM.yyyy HH:mm");
        }
        return createdAt;
    }
}
