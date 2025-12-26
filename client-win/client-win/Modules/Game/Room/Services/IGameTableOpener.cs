using System.Threading.Tasks;
using System.Windows.Controls;
using client_win.Modules.Catalog.Models;

namespace client_win.Modules.Game.Room.Services;

public interface IGameTableOpener
{
    Task OpenAsync(CatalogGame game, UserControl returnView);
}

