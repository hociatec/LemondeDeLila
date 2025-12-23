using System.Security;
using System.Threading.Tasks;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

public interface IAuthenticationService
{
    Task<LoginResult> LoginAsync(string username, SecureString password, bool rememberMe);

    Task<RegistrationResult> RegisterAsync(string username, string email, SecureString password);

    Task<bool> ValidateSessionAsync(AuthenticatedUser user);
}
