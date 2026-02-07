using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Audio.Models;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private static bool IsWallPlacementAction(GridAction action)
    {
        if (action == null) return false;
        if (action.HasOrientation) return true;
        var type = action.Type ?? string.Empty;
        return type.Contains("wall", StringComparison.OrdinalIgnoreCase) ||
               type.Contains("mur", StringComparison.OrdinalIgnoreCase) ||
               HasUiKind(action.Payload, "wall");
    }

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

        if (!_canInteract())
        {
            return;
        }

        var isCorridor = string.Equals(session.GameType, "corridor", System.StringComparison.OrdinalIgnoreCase);

        // Generic grid "grab" mechanic: Enter on an owned pawn toggles grab,
        // then Enter on a target cell triggers the first MOVE action for that cell.
        if (_isEntityGrabbed)
        {
            if (cell.HasOwnPawn)
            {
                _isEntityGrabbed = false;
                _sounds.Play(SoundId.PawnPlacedSelf);
                _announce("Pion repose.");
                return;
            }

            var move = actionsHere.FirstOrDefault(a => HasUiKey(a.Payload, "ENTER") && HasUiKind(a.Payload, "move"));
            if (move == null)
            {
                _announce("Déplacement impossible.");
                return;
            }

            await SendGridActionAsync(move).ConfigureAwait(true);
            _isEntityGrabbed = false;
            if (session.LastState != null)
            {
                SyncFromState(session.LastState, _viewerPlayerId);
            }
            return;
        }

        if (cell.HasOwnPawn)
        {
            _isEntityGrabbed = true;
            _sounds.Play(SoundId.PawnPicked);
            _announce("Pion pris. Choisissez une case et appuyez sur Entrée.");
            return;
        }

        // Corridor: éviter les déplacements accidentels sur une case cible.
        // Le joueur doit d'abord "prendre" son pion.
        if (isCorridor && actionsHere.Any(a => HasUiKind(a.Payload, "move")))
        {
            _announce("Prenez d'abord votre pion.");
            return;
        }

        // Default: on Enter, execute only actions that declare key=ENTER (or no key) to avoid
        // triggering actions meant for other keys (ex: wall placement).
        var enterActions = actionsHere.Where(a => MatchesUiKey(a.Payload, "ENTER")).ToList();
        if (enterActions.Count == 0)
        {
            TryAnnounceWallBlock(cell);
            return;
        }

        var chosen = await PickActionAsync(
                "Action",
                $"Choisir une action ({cell.CellRef}) :",
                enterActions)
            .ConfigureAwait(true);
        if (chosen == null)
        {
            return;
        }

        if (IsWallPlacementAction(chosen))
        {
            _pendingSelfWallSound = true;
        }
        await SendGridActionAsync(chosen).ConfigureAwait(true);
        if (session.LastState != null)
        {
            SyncFromState(session.LastState, _viewerPlayerId);
        }
    }

    public async Task TryExecuteFocusedCellActionsAsync(string keyHint, GridCellViewModel cell)
    {
        if (string.IsNullOrWhiteSpace(keyHint) || cell == null)
        {
            return;
        }

        if (!_canInteract())
        {
            return;
        }

        var session = _getSession();
        if (session == null || !session.IsConnected)
        {
            return;
        }

        var key = GridCellKey.From(cell);
        _gridActionsByCellKey.TryGetValue(key, out var actionsHere);
        actionsHere ??= new List<GridAction>();

        // Filter by declared ui key when present, otherwise fallback to all actions.
        var filtered = actionsHere.Where(a => HasUiKey(a.Payload, keyHint)).ToList();
        if (filtered.Count == 0)
        {
            filtered = actionsHere;
        }

        var chosen = await PickActionAsync(
                "Action",
                $"Choisir une action ({cell.CellRef}) :",
                filtered)
            .ConfigureAwait(true);
        if (chosen == null)
        {
            return;
        }

        if (IsWallPlacementAction(chosen))
        {
            _pendingSelfWallSound = true;
        }
        await SendGridActionAsync(chosen).ConfigureAwait(true);
        if (session.LastState != null)
        {
            SyncFromState(session.LastState, _viewerPlayerId);
        }
    }

    private static bool HasUiKind(System.Text.Json.JsonElement payload, string kind)
    {
        try
        {
            if (payload.ValueKind != System.Text.Json.JsonValueKind.Object) return false;
            if (!payload.TryGetProperty("_ui", out var ui) || ui.ValueKind != System.Text.Json.JsonValueKind.Object) return false;
            if (!ui.TryGetProperty("kind", out var k) || k.ValueKind != System.Text.Json.JsonValueKind.String) return false;
            return string.Equals((k.GetString() ?? string.Empty).Trim(), kind, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static bool HasUiKey(System.Text.Json.JsonElement payload, string key)
    {
        try
        {
            if (payload.ValueKind != System.Text.Json.JsonValueKind.Object) return false;
            if (!payload.TryGetProperty("_ui", out var ui) || ui.ValueKind != System.Text.Json.JsonValueKind.Object) return false;
            if (!ui.TryGetProperty("key", out var k) || k.ValueKind != System.Text.Json.JsonValueKind.String) return false;
            return string.Equals((k.GetString() ?? string.Empty).Trim(), key, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static bool MatchesUiKey(System.Text.Json.JsonElement payload, string key)
    {
        // If the action does not declare a key, treat it as eligible for ENTER.
        if (payload.ValueKind != System.Text.Json.JsonValueKind.Object)
        {
            return true;
        }
        try
        {
            if (!payload.TryGetProperty("_ui", out var ui) || ui.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return true;
            }
            if (!ui.TryGetProperty("key", out var k) || k.ValueKind != System.Text.Json.JsonValueKind.String)
            {
                return true;
            }
            var value = (k.GetString() ?? string.Empty).Trim();
            return string.Equals(value, key, StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return true;
        }
    }

    private void TryAnnounceWallBlock(GridCellViewModel cell)
    {
        if (cell == null || _viewerPlayerId is not > 0)
        {
            return;
        }

        if (!_lastPawnPosByOwnerId.TryGetValue(_viewerPlayerId.Value, out var viewerPos))
        {
            return;
        }

        var dx = cell.X - viewerPos.X;
        var dy = cell.Y - viewerPos.Y;
        if (Math.Abs(dx) + Math.Abs(dy) != 1)
        {
            return;
        }

        var viewerCell = Cells.FirstOrDefault(c => c.X == viewerPos.X && c.Y == viewerPos.Y);
        if (viewerCell == null)
        {
            return;
        }

        bool blocked = false;
        var direction = string.Empty;

        if (dx == 1)
        {
            blocked = cell.WallWest || viewerCell.WallEast;
            direction = "à droite";
        }
        else if (dx == -1)
        {
            blocked = cell.WallEast || viewerCell.WallWest;
            direction = "à gauche";
        }
        else if (dy == -1)
        {
            blocked = cell.WallSouth || viewerCell.WallNorth;
            direction = "devant";
        }
        else // dy == 1
        {
            blocked = cell.WallNorth || viewerCell.WallSouth;
            direction = "derrière";
        }

        if (blocked)
        {
            _announce($"Mur {direction} : déplacement impossible.");
        }
    }

    private async Task<GridAction?> PickActionAsync(
        string title,
        string message,
        List<GridAction> actions)
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

        var picked = await _dialogs.Pick(
                title,
                message,
                labels,
                okText: "Valider",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (picked == null)
        {
            return null;
        }

        return byLabel.TryGetValue(picked, out var chosen) ? chosen : null;
    }
}
