using System.Threading.Tasks;
using System.Windows;

namespace client_win.Modules.Presence.Services;

public interface IPresenceLauncher
{
    Task<string> OpenAsync(Window owner);
    Task CloseAsync();
}

