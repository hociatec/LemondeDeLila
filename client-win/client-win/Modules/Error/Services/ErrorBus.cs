using System;
using System.Collections.Generic;

namespace client_win.Modules.Error;

/// <summary>
/// Bus d'événements d'erreur simple, réutilisable dans tous les modules.
///
/// Thread-safe : Toutes les méthodes (Subscribe, Publish) peuvent être appelées
/// depuis n'importe quel thread de manière concurrente (UI thread, background threads, etc.).
///
/// Les handlers d'abonnés sont invoqués de manière synchrone mais les exceptions
/// dans les handlers sont capturées silencieusement pour protéger les autres abonnés.
/// </summary>
public sealed class ErrorBus
{
    private readonly List<Action<AppError>> _subscribers = new();
    private readonly object _sync = new();

    public IDisposable Subscribe(Action<AppError> handler)
    {
        if (handler == null) throw new ArgumentNullException(nameof(handler));
        lock (_sync)
        {
            _subscribers.Add(handler);
        }
        return new Subscription(_subscribers, _sync, handler);
    }

    public void Publish(AppError error)
    {
        if (error == null) throw new ArgumentNullException(nameof(error));
        Action<AppError>[] targets;
        lock (_sync)
        {
            targets = _subscribers.ToArray();
        }
        foreach (var handler in targets)
        {
            try
            {
                handler(error);
            }
            catch
            {
                // ignore handler errors to avoid breaking other subscribers
            }
        }
    }

    private sealed class Subscription : IDisposable
    {
        private readonly List<Action<AppError>> _list;
        private readonly object _sync;
        private readonly Action<AppError> _handler;
        private bool _disposed;

        public Subscription(List<Action<AppError>> list, object sync, Action<AppError> handler)
        {
            _list = list;
            _sync = sync;
            _handler = handler;
        }

        public void Dispose()
        {
            if (_disposed) return;
            lock (_sync)
            {
                _list.Remove(_handler);
            }
            _disposed = true;
        }
    }
}
