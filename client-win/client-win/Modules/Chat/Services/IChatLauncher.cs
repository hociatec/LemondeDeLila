using System.Threading.Tasks;
using System.Windows;

namespace client_win.Modules.Chat.Services;

public interface IChatLauncher
{
    Task<string> OpenAsync(Window owner);
    Task CloseAsync();
}
