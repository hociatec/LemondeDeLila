using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private bool DetectCorridor(GameStateDto state)
    {
        try
        {
            if (state?.Extras.ValueKind == System.Text.Json.JsonValueKind.Object &&
                state.Extras.TryGetProperty("corridor", out var corridor) &&
                corridor.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                return true;
            }
        }
        catch
        {
            // ignore
        }

        return _gridActionsByCellKey.Values.SelectMany(v => v).Any(a =>
            string.Equals(a.Type, "corridor_move", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(a.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase));
    }

    public async Task TryPromptCorridorWallPlacementAsync(GridCellViewModel cell)
    {
        if (!IsCorridor || cell == null)
        {
            return;
        }
        if (!_canInteract())
        {
            return;
        }

        var key = GridCellKey.From(cell);
        if (!_gridActionsByCellKey.TryGetValue(key, out var actions) || actions.Count == 0)
        {
            _announce("Impossible de placer un mur ici.");
            return;
        }

        var hasH = actions.Any(a =>
            string.Equals(a.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase) &&
            a.HasOrientation &&
            HasOrientation(a.Payload, "h"));
        var hasV = actions.Any(a =>
            string.Equals(a.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase) &&
            a.HasOrientation &&
            HasOrientation(a.Payload, "v"));

        if (!hasH && !hasV)
        {
            _announce("Impossible de placer un mur ici.");
            return;
        }

        var options = new List<string>();
        if (hasH) options.Add("Horizontal");
        if (hasV) options.Add("Vertical");

        var picked = await _dialogs.Pick(
                "Placer un mur",
                $"Orientation du mur ({cell.CellRef}) :",
                options,
                okText: "Valider",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (picked == null)
        {
            return;
        }

        var wanted = string.Equals(picked, "Horizontal", StringComparison.OrdinalIgnoreCase) ? "h" : "v";
        var wall = actions.FirstOrDefault(a =>
            string.Equals(a.Type, "corridor_place_wall", StringComparison.OrdinalIgnoreCase) &&
            a.HasOrientation &&
            HasOrientation(a.Payload, wanted));
        if (wall == null)
        {
            _announce("Mur impossible ici.");
            return;
        }

        await SendGridActionAsync(wall).ConfigureAwait(true);
        _announce("Action envoyée.");
        var session = _getSession();
        if (session?.LastState != null && _viewerPlayerId != null)
        {
            SyncFromState(session.LastState, _viewerPlayerId);
        }
    }
}
