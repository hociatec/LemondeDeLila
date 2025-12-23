using System.Threading.Tasks;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

public interface ICredentialStore
{
    Task SaveAsync(StoredCredentials credentials);

    Task<StoredCredentials?> LoadAsync();

    Task ClearAsync();
}
