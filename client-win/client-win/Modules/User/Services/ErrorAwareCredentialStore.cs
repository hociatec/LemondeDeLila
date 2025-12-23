using System.Threading.Tasks;
using client_win.Modules.Error;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

/// <summary>
/// Wrap un ICredentialStore pour publier une erreur en cas d'échec.
/// </summary>
public sealed class ErrorAwareCredentialStore : ICredentialStore
{
    private readonly ICredentialStore _inner;
    private readonly ErrorBus? _errors;

    public ErrorAwareCredentialStore(ICredentialStore inner, ErrorBus? errors)
    {
        _inner = inner;
        _errors = errors;
    }

    public async Task SaveAsync(StoredCredentials credentials)
    {
        try
        {
            await _inner.SaveAsync(credentials).ConfigureAwait(false);
        }
        catch (System.Exception ex)
        {
            _errors?.Publish(new AppError("Impossible de sauvegarder les identifiants.", ErrorSeverity.Warning, context: "credentials.save", detail: ex.Message));
            throw;
        }
    }

    public async Task<StoredCredentials?> LoadAsync()
    {
        try
        {
            return await _inner.LoadAsync().ConfigureAwait(false);
        }
        catch (System.Exception ex)
        {
            _errors?.Publish(new AppError("Impossible de charger les identifiants.", ErrorSeverity.Warning, context: "credentials.load", detail: ex.Message));
            return null;
        }
    }

    public async Task ClearAsync()
    {
        try
        {
            await _inner.ClearAsync().ConfigureAwait(false);
        }
        catch (System.Exception ex)
        {
            _errors?.Publish(new AppError("Impossible d'effacer les identifiants.", ErrorSeverity.Warning, context: "credentials.clear", detail: ex.Message));
            throw;
        }
    }
}
