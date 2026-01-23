namespace client_win.Modules.Vault.Models;

public sealed record VaultSnapshotItem(
    string Id,
    string Name,
    string RoomName,
    string GameType,
    string PlayersLabel,
    string CreatedAt);

