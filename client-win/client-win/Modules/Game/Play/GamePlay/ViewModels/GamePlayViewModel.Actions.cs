using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using Serilog;

namespace client_win.Modules.Game.Play.GamePlay.ViewModels;

public sealed partial class GamePlayViewModel
{
    private async Task RequestStateAsync()
    {
        var session = _session;
        if (session == null) return;
        try
        {
            await session.RequestStateAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de la demande de game.state");
        }
    }

    private async Task RequestTurnAsync()
    {
        var session = _session;
        if (session == null) return;
        try
        {
            _realtime.NoteForcedTurnRequest();
            await session.RequestTurnAsync().ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Erreur lors de la demande de game.turn");
        }
    }

    private bool CanStartAskCardSelection(GameStateDto? state)
    {
        if (state == null)
        {
            return false;
        }

        if (state.Pending != null)
        {
            return false;
        }

        if (!HasAction(state, "ask_card"))
        {
            return false;
        }

        return GamePlayChoiceBuilder.TryBuildAskCardChoices(state, out _);
    }

    private static bool HasAction(GameStateDto state, string actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return false;
        }

        var actions = state.Actions;
        if (actions == null || actions.Count == 0)
        {
            return false;
        }

        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }

    private bool CanSendActionNow(GameSession session) => session.IsConnected && !_isSpectator;
}
