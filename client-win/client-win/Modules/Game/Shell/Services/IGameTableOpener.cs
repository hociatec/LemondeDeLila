using System.Threading.Tasks;
using System.Windows.Controls;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Game.Shell.Services;

public interface IGameTableOpener
{
    Task OpenAsync(CatalogGame game, UserControl returnView);
    Task OpenExistingAsync(int roomId, UserControl returnView);
    Task OpenExistingAsync(int roomId, UserControl returnView, bool spectator);
    Task OpenExistingAsync(int roomId, UserControl returnView, bool spectator, bool silent);
}
