using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

public interface ISessionService
{
    AuthenticatedUser? CurrentUser { get; }

    void SetUser(AuthenticatedUser user);

    void Clear();
}
