using System;
using System.Threading;
using client_win.Modules.User.Models;

namespace client_win.Modules.User.Services;

/// <summary>
/// Service de gestion de session thread-safe.
/// Supporte l'accès concurrent depuis le thread UI et les threads réseau en arrière-plan.
/// Utilise ReaderWriterLockSlim pour permettre plusieurs lecteurs concurrents.
/// </summary>
public sealed class SessionService : ISessionService, IDisposable
{
    private readonly ReaderWriterLockSlim _lock = new();
    private AuthenticatedUser? _currentUser;

    /// <summary>
    /// Obtient l'utilisateur actuellement authentifié.
    /// Thread-safe : plusieurs threads peuvent lire concurremment.
    /// </summary>
    public AuthenticatedUser? CurrentUser
    {
        get
        {
            _lock.EnterReadLock();
            try
            {
                return _currentUser;
            }
            finally
            {
                _lock.ExitReadLock();
            }
        }
    }

    /// <summary>
    /// Définit l'utilisateur authentifié.
    /// Thread-safe : bloque les autres lectures et écritures pendant l'opération.
    /// </summary>
    public void SetUser(AuthenticatedUser user)
    {
        _lock.EnterWriteLock();
        try
        {
            _currentUser = user;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    /// <summary>
    /// Efface la session utilisateur.
    /// Thread-safe : bloque les autres lectures et écritures pendant l'opération.
    /// </summary>
    public void Clear()
    {
        _lock.EnterWriteLock();
        try
        {
            _currentUser = null;
        }
        finally
        {
            _lock.ExitWriteLock();
        }
    }

    /// <summary>
    /// Libère les ressources du verrou.
    /// </summary>
    public void Dispose()
    {
        _lock?.Dispose();
    }
}
