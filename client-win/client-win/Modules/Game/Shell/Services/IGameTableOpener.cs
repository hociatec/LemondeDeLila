using System.Threading.Tasks;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Game.Shell.Services;

public interface IGameTableOpener
{
    Task OpenAsync(CatalogGame game, object returnContent);
    Task OpenExistingAsync(int roomId, object returnContent);
    Task OpenExistingAsync(int roomId, object returnContent, bool spectator);
    Task OpenExistingAsync(int roomId, object returnContent, bool spectator, bool silent);
    Task OpenExistingAsync(int roomId, object returnContent, bool spectator, bool silent, string? vaultSnapshotId);
    void InvalidateTableAmbienceLabelsCache();
}
