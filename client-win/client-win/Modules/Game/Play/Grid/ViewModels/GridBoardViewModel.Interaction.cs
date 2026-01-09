using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private async Task HandleGridCellActivatedAsync(GridCellViewModel cell)
    {
        var session = _getSession();
        if (session == null || !session.IsConnected)
        {
            return;
        }

        if (_viewerPlayerId == null || _viewerPlayerId.Value <= 0)
        {
            return;
        }

        var key = GridCellKey.From(cell);
        _gridActionsByCellKey.TryGetValue(key, out var actionsHere);
        actionsHere ??= new List<GridAction>();

        if (actionsHere.Count == 0)
        {
            return;
        }

        var any = await PickActionAsync(
                "Action",
                $"Choisir une action (colonne {cell.Column}, ligne {cell.Row}) :",
                actionsHere)
            .ConfigureAwait(true);
        if (any == null)
        {
            return;
        }

        await SendGridActionAsync(any).ConfigureAwait(true);
        _announce("Action envoyée.");
        if (session.LastState != null)
        {
            SyncFromState(session.LastState, _viewerPlayerId);
        }
    }

    private async Task<GridAction?> PickActionAsync(string title, string message, List<GridAction> actions)
    {
        if (actions.Count == 0)
        {
            return null;
        }
        if (actions.Count == 1)
        {
            return actions[0];
        }

        var labels = GridActionLabelDisambiguator.MakeUniqueLabels(
            actions,
            getBaseLabel: a => string.IsNullOrWhiteSpace(a.Label) ? a.Type : a.Label,
            out var byLabel);

        var picked = await _dialogs.Pick(title, message, labels, okText: "Valider", cancelText: "Annuler").ConfigureAwait(true);
        if (picked == null)
        {
            return null;
        }

        return byLabel.TryGetValue(picked, out var chosen) ? chosen : null;
    }
}
