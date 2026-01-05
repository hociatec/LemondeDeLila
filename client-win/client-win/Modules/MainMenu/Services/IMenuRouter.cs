using System.Threading.Tasks;

namespace client_win.Modules.MainMenu.Services;

public interface IMenuRouter
{
    Task<string> OpenCatalog();
    Task<string> OpenStats();
    Task<string> OpenLeaderboard();
    Task<string> JoinGame();
    Task<string> OpenChat();
    Task<string> OpenMessaging();
    Task<string> OpenSocial();
    Task<string> OpenNotifications();
    Task<string> OpenContactAdmin();
    Task<string> OpenAdmin();
    Task<string> OpenAbout();
    Task<string> OpenOptions();
    Task<string> Logout();
}
