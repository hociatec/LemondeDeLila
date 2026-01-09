using System;
using System.Windows.Threading;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private void OnServerError(string message)
    {
        _dispatcher.InvokeAsync(() =>
        {
            ConnectionStatus = $"Erreur serveur: {message}";
            MessageReceived?.Invoke($"Erreur: {message}");
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

    private void OnUiMessageReceived(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }

        MessageReceived?.Invoke(message.Trim());
    }
}

