using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;

namespace client_win.Modules.Network.Services;

/// <summary>
/// Effectue un test de connexion WS simple pour remonter une erreur claire si l'hôte est injoignable.
/// </summary>
public static class WsConnectionTester
{
    public static async Task TestAsync(Uri endpoint, string? signature, Modules.Error.ErrorBus? errors, CancellationToken cancellationToken)
    {
        using var socket = new ClientWebSocket();
        if (!string.IsNullOrWhiteSpace(signature))
        {
            socket.Options.SetRequestHeader("x-lila-ws-signature", signature);
        }
        try
        {
            socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            await socket.ConnectAsync(endpoint, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            errors?.Publish(new Modules.Error.AppError(
                "Impossible de se connecter au serveur WS (vérifie port/secret).",
                Modules.Error.ErrorSeverity.Error,
                context: WsMessageTypes.ErrorContext.WsConnect,
                detail: ex.Message));
            throw;
        }
        finally
        {
            if (socket.State == WebSocketState.Open || socket.State == WebSocketState.CloseReceived)
            {
                try { await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "test-done", CancellationToken.None); } catch { }
            }
        }
    }
}
