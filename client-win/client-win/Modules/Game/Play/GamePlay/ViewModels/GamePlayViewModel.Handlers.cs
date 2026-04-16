using System;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Dtos;
using client_win.Modules.Game.Play.Session.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private void OnServerError(string message)
    {
        _ = _dispatcher.InvokeAsync(() =>
        {
            ConnectionStatus = $"Erreur serveur: {message}";
            MessageReceived?.Invoke(new GamePlayHistoryMessage($"Erreur: {message}"));
            RefreshCanExecute();
        }, DispatcherPriority.Background);

        _connection.HandleServerError(message);
    }

    private void OnCommandAckReceived(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        ConnectionStatus = message.Trim();
    }

    private void OnKeyAckReceived(GameKeyAckDto ack)
    {
        if (ack == null || !ack.Ok)
        {
            return;
        }

        // Trigger draw sound on the draw action itself (server-validated shortcut),
        // not by parsing log text.
        var key = (ack.Key ?? string.Empty).Trim();
        if (key.Length == 0)
        {
            return;
        }

        if (_actionTypeByServerKey.TryGetValue(key, out var actionType) &&
            string.Equals(actionType, "draw", StringComparison.OrdinalIgnoreCase))
        {
            _logSounds.TryPlayDrawSound();
        }
    }

    private void OnUiMessageReceived(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        MessageReceived?.Invoke(new GamePlayHistoryMessage(message.Trim()));
    }
}
