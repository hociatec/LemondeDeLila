using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using client_win.Core;
using client_win.Core.Input;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed class GridBoardViewModel : ObservableObject
{
    private sealed record GridAction(string Type, string Label, JsonElement Payload, bool HasOrientation);

    private readonly Dictionary<string, List<GridAction>> _gridActionsByCellKey = new(StringComparer.Ordinal);
    private readonly Dictionary<string, (bool n, bool e, bool s, bool w)> _gridBlockedEdges = new(StringComparer.Ordinal);
    private readonly IDialogService _dialogs;
    private readonly Func<GameSession?> _getSession;
    private readonly Func<bool> _canInteract;
    private readonly Action<string> _announce;
    private readonly AsyncRelayCommand<GridCellViewModel> _cellCommand;

    private int? _viewerPlayerId;
    private GridCellViewModel? _selectedPawnCell;
    private bool _isVisible;
    private int _size = 9;
    private string _status = string.Empty;

    public GridBoardViewModel(
        IDialogService dialogs,
        Func<GameSession?> getSession,
        Func<bool> canInteract,
        Action<string> announce)
    {
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _getSession = getSession ?? throw new ArgumentNullException(nameof(getSession));
        _canInteract = canInteract ?? throw new ArgumentNullException(nameof(canInteract));
        _announce = announce ?? throw new ArgumentNullException(nameof(announce));

        _cellCommand = new AsyncRelayCommand<GridCellViewModel>(
            async cell =>
            {
                if (cell == null) return;
                await HandleGridCellActivatedAsync(cell).ConfigureAwait(true);
            },
            canExecute: cell => _canInteract() && IsVisible && cell != null);
    }

    public bool IsVisible
    {
        get => _isVisible;
        private set => SetProperty(ref _isVisible, value);
    }

    public int Size
    {
        get => _size;
        private set => SetProperty(ref _size, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public ObservableCollection<GridCellViewModel> Cells { get; } = new();

    public ICommand CellCommand => _cellCommand;

    public void RefreshCanExecute() => _cellCommand.RaiseCanExecuteChanged();

    public void SyncFromState(GameStateDto state, int? viewerPlayerId)
    {
        if (state == null)
        {
            IsVisible = false;
            Status = string.Empty;
            return;
        }

        _viewerPlayerId = viewerPlayerId;

        if (!TryReadGridSize(state, out var size))
        {
            IsVisible = false;
            Status = string.Empty;
            RefreshCanExecute();
            return;
        }

        IsVisible = true;
        EnsureCells(size);

        var positions = state.Board?.Positions;
        var cellTagsByKey = TryReadGridCellTags(state);

        foreach (var cell in Cells)
        {
            cell.OccupantPlayerId = null;
            cell.IsOwnPawn = false;
            cell.IsLegalMove = false;
            cell.CellBorderThickness = new Thickness(1);
            cell.WallNorth = false;
            cell.WallSouth = false;
            cell.WallWest = false;
            cell.WallEast = false;
            cell.CanPlaceWallH = false;
            cell.CanPlaceWallV = false;
            cell.IsCarryingPawn = _selectedPawnCell != null;
            cell.IsSelectedPawn = false;
            cell.CellTags = new ObservableCollection<string>();
        }

        if (positions != null)
        {
            foreach (var kv in positions)
            {
                if (!int.TryParse(kv.Key, out var pid))
                {
                    continue;
                }

                var idx = kv.Value;
                if (idx < 0 || idx >= Cells.Count)
                {
                    continue;
                }

                Cells[idx].OccupantPlayerId = pid;
                if (viewerPlayerId != null && pid == viewerPlayerId.Value)
                {
                    Cells[idx].IsOwnPawn = true;
                }
            }
        }

        SyncGridStatus(state);
        ApplyGridWallsAccessibility(state);

        BuildGridActionsIndex(state);
        foreach (var cell in Cells)
        {
            var key = $"{cell.X},{cell.Y}";
            if (cellTagsByKey.TryGetValue(key, out var tags) && tags.Length > 0)
            {
                cell.CellTags = new ObservableCollection<string>(tags);
            }

            if (!_gridActionsByCellKey.TryGetValue(key, out var actions) || actions.Count == 0)
            {
                cell.ActionLabels = new ObservableCollection<string>();
                continue;
            }

            cell.ActionLabels = new ObservableCollection<string>(
                actions.Select(a => a.Label).Where(s => !string.IsNullOrWhiteSpace(s)));
            cell.CanPlaceWallH = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "h"));
            cell.CanPlaceWallV = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "v"));
        }

        var currentOwnPawn = Cells.FirstOrDefault(c => c.IsOwnPawn);
        if (_selectedPawnCell != null && currentOwnPawn != _selectedPawnCell)
        {
            _selectedPawnCell = null;
        }

        if (_selectedPawnCell != null)
        {
            _selectedPawnCell.IsSelectedPawn = true;
        }

        RefreshCanExecute();
    }

    public async Task HandleWallHotkeyAsync(GridCellViewModel cell)
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

        if (!IsViewerTurn(session.LastState, _viewerPlayerId))
        {
            _announce("Mur indisponible : ce n'est pas votre tour.");
            return;
        }

        if (_selectedPawnCell != null)
        {
            _announce("Mur indisponible : pion en main. Reposez le pion avant de poser un mur.");
            return;
        }

        var key = $"{cell.X},{cell.Y}";
        _gridActionsByCellKey.TryGetValue(key, out var actionsHere);
        actionsHere ??= new List<GridAction>();

        var wallActions = actionsHere.Where(a => a.HasOrientation).ToList();
        if (wallActions.Count == 0)
        {
            _announce($"Aucun mur possible à colonne {cell.Column}, ligne {cell.Row}.");
            return;
        }

        await PromptAndSendWallAsync(cell, wallActions).ConfigureAwait(true);
        if (session.LastState != null)
        {
            SyncFromState(session.LastState, _viewerPlayerId);
        }
    }

    private void EnsureCells(int size)
    {
        var safe = size <= 0 ? 9 : size;
        Size = safe;
        if (Cells.Count != safe * safe)
        {
            Cells.Clear();
            for (var y = 0; y < safe; y++)
            {
                for (var x = 0; x < safe; x++)
                {
                    var idx = y * safe + x;
                    Cells.Add(new GridCellViewModel(x, y, idx));
                }
            }
        }

        foreach (var cell in Cells)
        {
            cell.MaxColumns = safe;
            cell.MaxRows = safe;
        }
    }
    private void BuildGridActionsIndex(GameStateDto state)
    {
        _gridActionsByCellKey.Clear();

        var labelsByKeyAndType = TryReadGridCellActionLabels(state);

        var topLevelActions = state.Actions ?? new List<GameAvailableActionDto>();
        if (topLevelActions.Count == 0)
        {
            // Certains jeux/presenters exposent les actions uniquement dans extras.grid.cellActions.
            // Dans ce cas on reconstruit l'index directement depuis ces données.
            try
            {
                if (state.Extras.ValueKind == JsonValueKind.Object &&
                    state.Extras.TryGetProperty("grid", out var grid) &&
                    grid.ValueKind == JsonValueKind.Object &&
                    grid.TryGetProperty("cellActions", out var cellActions) &&
                    cellActions.ValueKind == JsonValueKind.Object)
                {
                    foreach (var cellProp in cellActions.EnumerateObject())
                    {
                        var key = cellProp.Name;
                        if (string.IsNullOrWhiteSpace(key) || cellProp.Value.ValueKind != JsonValueKind.Array)
                        {
                            continue;
                        }

                        foreach (var item in cellProp.Value.EnumerateArray())
                        {
                            if (item.ValueKind != JsonValueKind.Object)
                            {
                                continue;
                            }

                            var type = item.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String
                                ? (t.GetString() ?? string.Empty).Trim()
                                : string.Empty;
                            if (string.IsNullOrWhiteSpace(type))
                            {
                                continue;
                            }

                            var payload = item.TryGetProperty("payload", out var p) ? p : default;
                            var hasOrientation = payload.ValueKind == JsonValueKind.Object &&
                                                 payload.TryGetProperty("o", out var oNode) &&
                                                 oNode.ValueKind == JsonValueKind.String;

                            var orientation = OrientationValue(payload);
                            var label = item.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String
                                ? (l.GetString() ?? string.Empty).Trim()
                                : string.Empty;
                            if (labelsByKeyAndType.TryGetValue((key, type, orientation), out var resolved))
                            {
                                label = resolved;
                            }
                            if (string.IsNullOrWhiteSpace(label))
                            {
                                label = type;
                            }

                            if (!_gridActionsByCellKey.TryGetValue(key, out var list))
                            {
                                list = new List<GridAction>();
                                _gridActionsByCellKey[key] = list;
                            }

                            list.Add(new GridAction(type, label, payload, hasOrientation));
                        }
                    }

                    return;
                }
            }
            catch
            {
                // ignore
            }
        }

        foreach (var action in topLevelActions)
        {
            if (action == null) continue;
            if (action.Payload.ValueKind != JsonValueKind.Object) continue;

            if (!action.Payload.TryGetProperty("x", out var xNode) ||
                !action.Payload.TryGetProperty("y", out var yNode) ||
                !xNode.TryGetInt32(out var x) ||
                !yNode.TryGetInt32(out var y))
            {
                continue;
            }

            var key = $"{x},{y}";
            var hasOrientation = action.Payload.TryGetProperty("o", out var oNode) && oNode.ValueKind == JsonValueKind.String;

            var orientation = OrientationValue(action.Payload);
            var label = action.Label;
            if (labelsByKeyAndType.TryGetValue((key, action.Type, orientation), out var resolved))
            {
                label = resolved;
            }
            if (string.IsNullOrWhiteSpace(label))
            {
                label = action.Type;
            }

            if (!_gridActionsByCellKey.TryGetValue(key, out var list))
            {
                list = new List<GridAction>();
                _gridActionsByCellKey[key] = list;
            }

            list.Add(new GridAction(action.Type, label!, action.Payload, hasOrientation));
        }
    }

    private static string OrientationValue(JsonElement payload)
    {
        try
        {
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty("o", out var oNode) &&
                oNode.ValueKind == JsonValueKind.String)
            {
                return (oNode.GetString() ?? string.Empty).Trim().ToLowerInvariant();
            }
        }
        catch
        {
            // ignore
        }
        return string.Empty;
    }

    private static bool HasOrientation(JsonElement payload, string expected)
    {
        var o = OrientationValue(payload);
        return string.Equals(o, expected, StringComparison.OrdinalIgnoreCase);
    }

    private static Dictionary<(string key, string type, string o), string> TryReadGridCellActionLabels(GameStateDto state)
    {
        var dict = new Dictionary<(string, string, string), string>();
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("cellActions", out var cellActions) ||
                cellActions.ValueKind != JsonValueKind.Object)
            {
                return dict;
            }

            foreach (var cellProp in cellActions.EnumerateObject())
            {
                var key = cellProp.Name;
                if (cellProp.Value.ValueKind != JsonValueKind.Array) continue;
                foreach (var item in cellProp.Value.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;
                    var type = item.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String ? (t.GetString() ?? "") : "";
                    var label = item.TryGetProperty("label", out var l) && l.ValueKind == JsonValueKind.String ? (l.GetString() ?? "") : "";
                    var o = string.Empty;
                    if (item.TryGetProperty("payload", out var p) && p.ValueKind == JsonValueKind.Object)
                    {
                        o = OrientationValue(p);
                    }

                    if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(type) && !string.IsNullOrWhiteSpace(label))
                    {
                        dict[(key, type.Trim(), o)] = label.Trim();
                    }
                }
            }
        }
        catch
        {
            // ignore
        }

        return dict;
    }
    private static Dictionary<string, string[]> TryReadGridCellTags(GameStateDto state)
    {
        var dict = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("cellTags", out var cellTags) ||
                cellTags.ValueKind != JsonValueKind.Object)
            {
                return dict;
            }

            foreach (var cellProp in cellTags.EnumerateObject())
            {
                if (string.IsNullOrWhiteSpace(cellProp.Name)) continue;
                if (cellProp.Value.ValueKind != JsonValueKind.Array) continue;
                var tags = cellProp.Value.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => (e.GetString() ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                if (tags.Length > 0)
                {
                    dict[cellProp.Name.Trim()] = tags;
                }
            }
        }
        catch
        {
            // ignore
        }
        return dict;
    }

    private void SyncGridStatus(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object)
            {
                Status = string.Empty;
                return;
            }

            if (grid.TryGetProperty("statusLines", out var linesNode) &&
                linesNode.ValueKind == JsonValueKind.Array)
            {
                var lines = linesNode.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => (e.GetString() ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToArray();
                Status = lines.Length > 0 ? string.Join(" ", lines) : string.Empty;
                return;
            }

            Status = string.Empty;
        }
        catch
        {
            Status = string.Empty;
        }
    }

    private void ApplyGridWallsAccessibility(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("blockedEdges", out var blocked) ||
                blocked.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            _gridBlockedEdges.Clear();
            foreach (var prop in blocked.EnumerateObject())
            {
                if (prop.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var edges = prop.Value;
                var n = edges.TryGetProperty("n", out var nn) && nn.ValueKind == JsonValueKind.True;
                var e = edges.TryGetProperty("e", out var ee) && ee.ValueKind == JsonValueKind.True;
                var s = edges.TryGetProperty("s", out var ss) && ss.ValueKind == JsonValueKind.True;
                var w = edges.TryGetProperty("w", out var ww) && ww.ValueKind == JsonValueKind.True;
                _gridBlockedEdges[prop.Name] = (n, e, s, w);
            }

            for (var y = 0; y < Size; y++)
            {
                for (var x = 0; x < Size; x++)
                {
                    var idx = y * Size + x;
                    if (idx < 0 || idx >= Cells.Count) continue;
                    var cell = Cells[idx];

                    if (!blocked.TryGetProperty($"{x},{y}", out var edges) ||
                        edges.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    // Pour l'annonce lecteur d'écran : ne pas annoncer les bords (seulement les murs internes).
                    var nBlocked = edges.TryGetProperty("n", out var n) && n.ValueKind == JsonValueKind.True;
                    var eBlocked = edges.TryGetProperty("e", out var e) && e.ValueKind == JsonValueKind.True;
                    var sBlocked = edges.TryGetProperty("s", out var s) && s.ValueKind == JsonValueKind.True;
                    var wBlocked = edges.TryGetProperty("w", out var w) && w.ValueKind == JsonValueKind.True;

                    cell.WallNorth = nBlocked && y > 0;
                    cell.WallSouth = sBlocked && y < Size - 1;
                    cell.WallWest = wBlocked && x > 0;
                    cell.WallEast = eBlocked && x < Size - 1;

                    var thick = 4.0;
                    cell.CellBorderThickness = new Thickness(
                        cell.WallWest ? thick : 1,
                        cell.WallNorth ? thick : 1,
                        cell.WallEast ? thick : 1,
                        cell.WallSouth ? thick : 1);
                }
            }
        }
        catch
        {
            // ignore
        }
    }

    private static int? TryReadCorridorSize(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!state.Extras.TryGetProperty("corridor", out var corridor) ||
                corridor.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            if (!corridor.TryGetProperty("size", out var sizeNode))
            {
                return null;
            }

            if (sizeNode.ValueKind == JsonValueKind.Number && sizeNode.TryGetInt32(out var asInt))
            {
                return asInt;
            }

            if (sizeNode.ValueKind == JsonValueKind.String && int.TryParse(sizeNode.GetString(), out var parsed))
            {
                return parsed;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static bool TryReadGridSize(GameStateDto state, out int size)
    {
        size = 0;
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (state.Extras.TryGetProperty("grid", out var grid) &&
                grid.ValueKind == JsonValueKind.Object &&
                grid.TryGetProperty("size", out var sizeNode))
            {
                if (sizeNode.ValueKind == JsonValueKind.Number && sizeNode.TryGetInt32(out var asInt))
                {
                    size = asInt;
                    return size > 0;
                }

                if (sizeNode.ValueKind == JsonValueKind.String &&
                    int.TryParse(sizeNode.GetString(), out var parsed))
                {
                    size = parsed;
                    return size > 0;
                }
            }

            // Fallback legacy.
            var legacy = TryReadCorridorSize(state);
            if (legacy != null && legacy.Value > 0)
            {
                size = legacy.Value;
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
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

        if (!IsViewerTurn(session.LastState, _viewerPlayerId))
        {
            _announce("Action impossible : ce n'est pas votre tour.");
            return;
        }

        if (cell.IsOwnPawn)
        {
            if (_selectedPawnCell == cell)
            {
                _selectedPawnCell = null;
                _announce("Pion reposé.");
            }
            else
            {
                _selectedPawnCell = cell;
                _announce("Pion pris.");
            }

            if (session.LastState != null)
            {
                SyncFromState(session.LastState, _viewerPlayerId);
            }
            return;
        }

        var key = $"{cell.X},{cell.Y}";
        _gridActionsByCellKey.TryGetValue(key, out var actionsHere);
        actionsHere ??= new List<GridAction>();

        if (_selectedPawnCell != null)
        {
            var moveActions = actionsHere.Where(a => !a.HasOrientation).ToList();
            if (moveActions.Count == 0)
            {
                var reason = TryExplainBlockedMove(_selectedPawnCell, cell);
                _announce(reason ?? "Déplacement interdit.");
                return;
            }

            var chosen = await PickActionAsync(
                    "Action",
                    $"Choisir une action (colonne {cell.Column}, ligne {cell.Row}) :",
                    moveActions)
                .ConfigureAwait(true);
            if (chosen == null)
            {
                return;
            }

            await SendGridActionAsync(chosen).ConfigureAwait(true);
            _selectedPawnCell = null;
            _announce("Action envoyée.");
            if (session.LastState != null)
            {
                SyncFromState(session.LastState, _viewerPlayerId);
            }
            return;
        }

        // Pas de pion en main: si on a des actions, on choisit. Pour les murs, on force le choix Horizontal/Vertical.
        var wallActions = actionsHere.Where(a => a.HasOrientation).ToList();
        if (wallActions.Count > 0)
        {
            await PromptAndSendWallAsync(cell, wallActions).ConfigureAwait(true);
            if (session.LastState != null)
            {
                SyncFromState(session.LastState, _viewerPlayerId);
            }
            return;
        }

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

        var labels = new List<string>();
        var byLabel = new Dictionary<string, GridAction>(StringComparer.Ordinal);
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var action in actions)
        {
            var baseLabel = string.IsNullOrWhiteSpace(action.Label) ? action.Type : action.Label;
            counts.TryGetValue(baseLabel, out var n);
            n++;
            counts[baseLabel] = n;
            var label = n == 1 ? baseLabel : $"{baseLabel} ({n})";
            labels.Add(label);
            byLabel[label] = action;
        }

        var picked = await _dialogs.Pick(title, message, labels, okText: "Valider", cancelText: "Annuler").ConfigureAwait(true);
        if (picked == null)
        {
            return null;
        }

        return byLabel.TryGetValue(picked, out var chosen) ? chosen : null;
    }

    private string? TryExplainBlockedMove(GridCellViewModel from, GridCellViewModel to)
    {
        if (to.IsOccupied)
        {
            return "Déplacement interdit : case occupée.";
        }

        var dx = to.X - from.X;
        var dy = to.Y - from.Y;
        if (Math.Abs(dx) + Math.Abs(dy) == 1)
        {
            var key = $"{from.X},{from.Y}";
            if (_gridBlockedEdges.TryGetValue(key, out var edges))
            {
                if (dx == 1 && edges.e) return "Déplacement interdit : mur à droite.";
                if (dx == -1 && edges.w) return "Déplacement interdit : mur à gauche.";
                if (dy == 1 && edges.s) return "Déplacement interdit : mur en bas.";
                if (dy == -1 && edges.n) return "Déplacement interdit : mur en haut.";
            }
            return "Déplacement interdit.";
        }

        return "Déplacement interdit.";
    }

    private async Task PromptAndSendWallAsync(GridCellViewModel cell, List<GridAction> wallActions)
    {
        var horizontal = wallActions.FirstOrDefault(a => HasOrientation(a.Payload, "h"));
        var vertical = wallActions.FirstOrDefault(a => HasOrientation(a.Payload, "v"));

        if (horizontal != null && vertical != null)
        {
            var choice = await _dialogs.Choose(
                    title: "Mur",
                    message: $"Poser un mur à colonne {cell.Column}, ligne {cell.Row} :",
                    primaryText: "Horizontal",
                    secondaryText: "Vertical",
                    cancelText: "Annuler")
                .ConfigureAwait(true);

            if (choice == DialogChoice.Primary)
            {
                await SendGridActionAsync(horizontal).ConfigureAwait(true);
                _announce($"Mur horizontal posé à colonne {cell.Column}, ligne {cell.Row}.");
            }
            else if (choice == DialogChoice.Secondary)
            {
                await SendGridActionAsync(vertical).ConfigureAwait(true);
                _announce($"Mur vertical posé à colonne {cell.Column}, ligne {cell.Row}.");
            }

            return;
        }

        var only = horizontal ?? vertical ?? (wallActions.Count > 0 ? wallActions[0] : null);
        if (only == null)
        {
            return;
        }

        var ok = await _dialogs.Confirm(
                "Mur",
                $"Poser un mur à colonne {cell.Column}, ligne {cell.Row} ?",
                okText: "Poser",
                cancelText: "Annuler")
            .ConfigureAwait(true);
        if (ok == true)
        {
            await SendGridActionAsync(only).ConfigureAwait(true);
            _announce($"Mur posé à colonne {cell.Column}, ligne {cell.Row}.");
        }
    }

    private static bool IsViewerTurn(GameStateDto? state, int? viewerPlayerId)
    {
        if (state == null || viewerPlayerId == null || viewerPlayerId.Value <= 0)
        {
            return false;
        }

        // Source de vérité côté client: si le serveur nous fournit des actions, c'est forcément notre tour.
        try
        {
            if ((state.Actions?.Count ?? 0) > 0)
            {
                return true;
            }
            if (state.Extras.ValueKind == JsonValueKind.Object &&
                state.Extras.TryGetProperty("grid", out var grid) &&
                grid.ValueKind == JsonValueKind.Object &&
                grid.TryGetProperty("cellActions", out var cellActions) &&
                cellActions.ValueKind == JsonValueKind.Object)
            {
                foreach (var cellProp in cellActions.EnumerateObject())
                {
                    if (cellProp.Value.ValueKind != JsonValueKind.Array) continue;
                    if (cellProp.Value.EnumerateArray().Any())
                    {
                        return true;
                    }
                }
            }
        }
        catch
        {
            // ignore
        }

        // Fallback: comparer au tour courant si exposé.
        var current = state.Turn?.CurrentPlayerId;
        return current != null && current.Value == viewerPlayerId.Value;
    }

    private async Task SendGridActionAsync(GridAction action)
    {
        var session = _getSession();
        if (session == null || !session.IsConnected)
        {
            return;
        }

        try
        {
            var payload = JsonToObject(action.Payload);
            await session.SendActionsAsync(new[] { new GameClientAction(action.Type, payload: payload) }, CancellationToken.None)
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

    private static object? JsonToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Undefined => null,
            JsonValueKind.Null => null,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.TryGetDouble(out var d) ? d : null,
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Array => element.EnumerateArray().Select(JsonToObject).ToList(),
            JsonValueKind.Object => element.EnumerateObject().ToDictionary(p => p.Name, p => JsonToObject(p.Value), StringComparer.Ordinal),
            _ => null,
        };
    }
}
