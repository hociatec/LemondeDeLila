using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Diagnostics;
using client_win.Modules.Network.Services;
using Serilog;

namespace client_win.Modules.Network;

/// <summary>
/// Couche légère pour envoyer des requêtes typées via le client WS persistant.
/// </summary>
public sealed class WsRequestClient
{
    private readonly PersistentWsClient _client;
    private readonly IWsTicketProvider _tickets;
    private readonly Modules.Error.ErrorBus? _errorBus;
    private static readonly JsonSerializerOptions _deserializeOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan[] _ticketRetryDelays =
    [
        TimeSpan.FromMilliseconds(120),
        TimeSpan.FromMilliseconds(250),
        TimeSpan.FromMilliseconds(400),
    ];

    public WsRequestClient(PersistentWsClient client, IWsTicketProvider tickets, Modules.Error.ErrorBus? errorBus = null)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _tickets = tickets ?? throw new ArgumentNullException(nameof(tickets));
        _errorBus = errorBus;
    }

    public async Task<WsResponse<TPayload>> RequestAsync<TPayload>(string type, object payload, string? token, CancellationToken cancellationToken = default)
    {
        UiThreadGuard.WarnIfOnUiThread("ws.request", type);

        string raw;
        try
        {
            Log.Debug("WS request: {Type}", type);
            using var _ = UiThreadGuard.MeasureUiThreadContinuation("ws.request", type);
            var wsTicket = await GetApiTicketOrThrowAsync(token, cancellationToken).ConfigureAwait(false);
            raw = await _client.SendAsync(type, payload, token, wsTicket, cancellationToken).ConfigureAwait(false);
        }
        catch (InvalidOperationException ioex) when (string.Equals(ioex.Message, "ws.ticket.missing", StringComparison.Ordinal))
        {
            var message = $"Impossible d'obtenir un ticket WebSocket (requete '{type}'). Reessayez dans quelques secondes.";
            _errorBus?.Publish(new Modules.Error.AppError(message, Modules.Error.ErrorSeverity.Error, context: type, detail: "ticket_missing"));
            Log.Warning("WS ticket missing for request: {Type}", type);
            return WsResponse<TPayload>.Fail(type, message);
        }
        catch (TaskCanceledException tex)
        {
            var message = $"La requête temps réel '{type}' a expiré.";
            _errorBus?.Publish(new Modules.Error.AppError(message, Modules.Error.ErrorSeverity.Error, context: type, detail: tex.Message));
            Log.Warning(tex, "WS timeout: {Type}", type);
            return WsResponse<TPayload>.Fail(type, message);
        }
        catch (Exception ex)
        {
            _errorBus?.Publish(new Modules.Error.AppError("Requête temps réel échouée.", Modules.Error.ErrorSeverity.Error, context: type, detail: ex.Message));
            Log.Warning(ex, "WS error: {Type}", type);
            return WsResponse<TPayload>.Fail(type, ex.Message);
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;
        string responseType = root.TryGetProperty("type", out var t) ? t.GetString() ?? type : type;
        string? reqId = root.TryGetProperty("requestId", out var id) ? id.GetString() : null;
        Log.Debug("WS response: {Type} ({RequestId})", responseType, reqId ?? "?");
        if (string.Equals(responseType, "error", StringComparison.OrdinalIgnoreCase))
        {
            string? context = root.TryGetProperty("context", out var c) ? c.GetString() : null;
            string message = root.TryGetProperty("payload", out var p) &&
                             p.TryGetProperty("message", out var msg)
                ? msg.GetString() ?? "Erreur temps réel"
                : "Erreur temps réel";
            // UX: le backend renvoie parfois un context identique au type de requête (ex: "auth.login").
            // Éviter d'afficher un "Détail: auth.login" inutile aux joueurs.
            var detail = string.IsNullOrWhiteSpace(context) ? null : context.Trim();
            if (!string.IsNullOrWhiteSpace(detail) &&
                string.Equals(detail, type, StringComparison.OrdinalIgnoreCase))
            {
                detail = null;
            }
            _errorBus?.Publish(new Modules.Error.AppError(message, Modules.Error.ErrorSeverity.Error, context: type, detail: detail));
            // On conserve le type demandé pour faciliter le diagnostic côté appelant.
            return WsResponse<TPayload>.Fail(type, message);
        }

        TPayload? data = default;
        if (root.TryGetProperty("payload", out var payloadNode))
        {
            data = payloadNode.Deserialize<TPayload>(_deserializeOptions);
        }
        return WsResponse<TPayload>.Ok(responseType, data, reqId);
    }

    private async Task<string?> GetApiTicketOrThrowAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        for (int attempt = 0; attempt <= _ticketRetryDelays.Length; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var wsTicket = await _tickets.GetTicketAsync("api", cancellationToken).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(wsTicket))
            {
                return wsTicket;
            }

            if (attempt < _ticketRetryDelays.Length)
            {
                await Task.Delay(_ticketRetryDelays[attempt], cancellationToken).ConfigureAwait(false);
            }
        }

        throw new InvalidOperationException("ws.ticket.missing");
    }
}

public sealed class WsResponse<TPayload>
{
    private WsResponse(bool success, string type, TPayload? payload, string? requestId, string? error)
    {
        Success = success;
        Type = type;
        Payload = payload;
        RequestId = requestId;
        Error = error;
    }

    public bool Success { get; }
    public string Type { get; }
    public TPayload? Payload { get; }
    public string? RequestId { get; }
    public string? Error { get; }

    public static WsResponse<TPayload> Ok(string type, TPayload? payload, string? requestId) => new(true, type, payload, requestId, null);

    public static WsResponse<TPayload> Fail(string type, string message) => new(false, type, default, null, message);
}
