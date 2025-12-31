using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using Serilog;

namespace client_win.Modules.Network.Services;

/// <summary>
/// Effectue un test de connexion WS simple pour remonter une erreur claire si l'hôte est injoignable.
/// </summary>
public static class WsConnectionTester
{
    public static async Task TestAsync(Uri endpoint, Modules.Error.ErrorBus? errors, CancellationToken cancellationToken)
    {
        using var socket = new ClientWebSocket();
        try
        {
            socket.Options.KeepAliveInterval = TimeSpan.FromSeconds(10);
            await socket.ConnectAsync(endpoint, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            errors?.Publish(new Modules.Error.AppError(
                "Impossible de se connecter au serveur WS (vérifie l'URL et la connectivité).",
                Modules.Error.ErrorSeverity.Error,
                context: WsMessageTypes.ErrorContext.WsConnect,
                detail: ex.Message));
            throw;
        }
        finally
        {
            if (socket.State == WebSocketState.Open || socket.State == WebSocketState.CloseReceived)
            {
                try
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "test-done", CancellationToken.None);
                }
                catch (Exception ex)
                {
                    // JUSTIFICATION: Erreur de fermeture non-critique lors du cleanup
                    // Causes possibles: connexion déjà fermée, timeout
                    // RECOVERY: Socket sera disposé automatiquement par le using
                    Log.Debug(ex, "Échec de fermeture du socket de test (non-critique, sera disposé)");
                }
            }
        }
    }
}
