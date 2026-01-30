using System;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Dtos;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private void OnServerError(string message)
    {
        _dispatcher.InvokeAsync(() =>
        {
            try
            {
                ConnectionStatus = $"Erreur serveur: {message}";
                MessageReceived?.Invoke(new GamePlayHistoryMessage($"Erreur: {message}"));
                RefreshCanExecute();
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "Erreur lors de la gestion d'une erreur serveur (handled)");
            }
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

        MessageReceived?.Invoke(new GamePlayHistoryMessage(message.Trim()));
    }
}
