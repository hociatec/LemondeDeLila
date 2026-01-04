using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Core.Network;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Network;
using client_win.Modules.Error;
using client_win.Modules.User.Services;

namespace client_win.Modules.Catalog.Services;

/// <summary>
/// Récupère le catalogue auprès du backend via WebSocket (catalog.all).
/// </summary>
public sealed class CatalogService : ICatalogService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;
    private readonly object _sync = new();
    private CatalogPayload? _cached;
    private DateTime _cachedAtUtc;
    private Task<CatalogPayload>? _inflight;
    private static readonly TimeSpan _cacheTtl = TimeSpan.FromMinutes(2);
    private readonly TimeSpan _defaultFetchTimeout;

    public event EventHandler? CacheInvalidated;

    public CatalogService(WsRequestClient ws, ISessionService session, ErrorBus? errors = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
        var network = NetworkConfiguration.Load();
        // On s'aligne sur le timeout WS (Recv) et on garde une petite marge pour éviter un "faux timeout"
        // quand le backend est juste un peu lent (cold start, I/O disque, etc.).
        _defaultFetchTimeout = TimeSpan.FromSeconds(Math.Max(30, network.ReceiveTimeoutSeconds + 5));
    }

    public async Task<CatalogPayload> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        var cached = _cached;
        if (cached != null && (DateTime.UtcNow - _cachedAtUtc) < _cacheTtl)
        {
            return cached;
        }

        Task<CatalogPayload> fetchTask;
        lock (_sync)
        {
            cached = _cached;
            if (cached != null && (DateTime.UtcNow - _cachedAtUtc) < _cacheTtl)
            {
                return cached;
            }

            _inflight ??= CreateFetchTask(publishErrors: true);
            fetchTask = _inflight;
        }

        // N'annule pas le fetch global, mais permet à l'appelant d'arrêter d'attendre.
        var fresh = await fetchTask.WaitAsync(cancellationToken).ConfigureAwait(false);
        return fresh;
    }

    public void InvalidateCache()
    {
        EventHandler? handler;
        lock (_sync)
        {
            _cached = null;
            _cachedAtUtc = default;
            _inflight = null;
            handler = CacheInvalidated;
        }

        try
        {
            handler?.Invoke(this, EventArgs.Empty);
        }
        catch
        {
            // best-effort
        }
    }

    public async Task PreloadAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            Task<CatalogPayload>? fetchTask = null;
            lock (_sync)
            {
                if (_cached != null && (DateTime.UtcNow - _cachedAtUtc) < _cacheTtl)
                {
                    return;
                }
                _inflight ??= CreateFetchTask(publishErrors: false);
                fetchTask = _inflight;
            }

            if (fetchTask != null)
            {
                await fetchTask.WaitAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        catch
        {
            // Préchargement best-effort : ne pas faire échouer le démarrage du menu.
        }
    }

    private Task<CatalogPayload> CreateFetchTask(bool publishErrors)
    {
        // IMPORTANT: on ne prend pas un CancellationToken d'appelant pour éviter qu'un cancel annule la requête partagée.
        var task = FetchCatalogAsync(CancellationToken.None, publishErrors);
        _ = task.ContinueWith(t =>
        {
            lock (_sync)
            {
                if (ReferenceEquals(_inflight, task))
                {
                    _inflight = null;
                }
                if (t.Status == TaskStatus.RanToCompletion)
                {
                    _cached = t.Result;
                    _cachedAtUtc = DateTime.UtcNow;
                }
            }
        }, TaskScheduler.Default);
        return task;
    }

    private async Task<CatalogPayload> FetchCatalogAsync(CancellationToken cancellationToken, bool publishErrors)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        WsResponse<CatalogAllPayload> response;
        try
        {
            using var hardTimeout = cancellationToken.CanBeCanceled
                ? null
                : new CancellationTokenSource(_defaultFetchTimeout);
            using var linked = hardTimeout != null
                ? CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, hardTimeout.Token)
                : null;

            response = await _ws.RequestAsync<CatalogAllPayload>(
                WsMessageTypes.Catalog.All,
                new { },
                token,
                linked?.Token ?? cancellationToken).ConfigureAwait(false);
        }
        catch (TaskCanceledException)
        {
            var message = "Le catalogue n'a pas répondu à temps (délai dépassé).";
            if (publishErrors) PublishError(message);
            throw new InvalidOperationException(message);
        }

        if (!response.Success || response.Payload == null)
        {
            var message = response.Error ?? "Chargement du catalogue impossible.";
            if (publishErrors) PublishError(message);
            throw new InvalidOperationException(message);
        }

        var categories = response.Payload.Categories ?? new List<CatalogCategory>();
        var games = response.Payload.Games ?? new List<CatalogGame>();
        return new CatalogPayload(categories, games);
    }

    private void PublishError(string message)
    {
        _errors?.Publish(new AppError(message, ErrorSeverity.Error, context: WsMessageTypes.ErrorContext.CatalogAll));
    }

    private sealed class CatalogAllPayload
    {
        [JsonPropertyName("categories")]
        public List<CatalogCategory>? Categories { get; set; }

        [JsonPropertyName("games")]
        public List<CatalogGame>? Games { get; set; }
    }
}
