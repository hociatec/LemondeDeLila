using System.Threading.Tasks;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

public sealed class InMemoryCredentialStore : ICredentialStore
{
    private StoredCredentials? _credentials;

    public Task SaveAsync(StoredCredentials credentials)
    {
        _credentials = credentials;
        return Task.CompletedTask;
    }

    public Task<StoredCredentials?> LoadAsync() => Task.FromResult(_credentials);

    public Task ClearAsync()
    {
        _credentials = null;
        return Task.CompletedTask;
    }
}
