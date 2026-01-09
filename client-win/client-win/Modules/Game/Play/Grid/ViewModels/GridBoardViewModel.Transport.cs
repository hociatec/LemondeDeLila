using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.Session.Services;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private async Task SendGridActionAsync(GridAction action)
    {
        var session = _getSession();
        if (session == null || !session.IsConnected)
        {
            return;
        }

        try
        {
            var payload = GridJsonObjectConverter.ToObject(action.Payload);
            await session.SendActionsAsync(
                    new[] { new GameClientAction(action.Type, payload: payload) },
                    CancellationToken.None)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            try
            {
                await _dialogs.ShowError("Jeu", $"Impossible d'envoyer l'action : {ex.Message}").ConfigureAwait(true);
            }
            catch
            {
                // ignore
            }
        }
    }
}

