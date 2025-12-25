using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Serilog;

namespace client_win.Modules.Network;

/// <summary>
/// Couche légère pour envoyer des requêtes typées via le client WS persistant.
/// </summary>
public sealed class WsRequestClient
{
    private readonly PersistentWsClient _client;
    private readonly string? _sharedSecret;
    private readonly Modules.Error.ErrorBus? _errorBus;
    private static readonly JsonSerializerOptions _deserializeOptions = new(JsonSerializerDefaults.Web);

    public WsRequestClient(PersistentWsClient client, string? sharedSecret, Modules.Error.ErrorBus? errorBus = null)
    {
        _client = client ?? throw new ArgumentNullException(nameof(client));
        _sharedSecret = sharedSecret;
        _errorBus = errorBus;
    }

    public async Task<WsResponse<TPayload>> RequestAsync<TPayload>(string type, object payload, string? token, CancellationToken cancellationToken = default)
    {
        string raw;
        try
        {
            Log.Debug("WS request: {Type}", type);
            raw = await _client.SendAsync(type, payload, token, _sharedSecret, cancellationToken).ConfigureAwait(false);
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
            _errorBus?.Publish(new Modules.Error.AppError(message, Modules.Error.ErrorSeverity.Error, context: type, detail: context));
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
