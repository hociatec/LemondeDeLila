using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private void SyncFromStateCore(GameStateDto state, int? viewerPlayerId)
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

        var entitiesByKey = TryReadGridEntities(state);
        var cellTagsByKey = TryReadGridCellTags(state);

        foreach (var cell in Cells)
        {
            cell.CellBorderThickness = new Thickness(1);
            cell.WallNorth = false;
            cell.WallSouth = false;
            cell.WallWest = false;
            cell.WallEast = false;
            cell.CanPlaceWallH = false;
            cell.CanPlaceWallV = false;
            cell.CellTags = new ObservableCollection<string>();
            cell.Glyph = string.Empty;
            cell.EntitiesCount = 0;
            cell.EntityTypes = new ObservableCollection<string>();
        }

        foreach (var kv in entitiesByKey)
        {
            if (!TryParseCellKey(kv.Key, out var x, out var y))
            {
                continue;
            }

            var idx = y * Size + x;
            if (idx < 0 || idx >= Cells.Count)
            {
                continue;
            }

            var entities = kv.Value;
            if (entities == null || entities.Count == 0)
            {
                continue;
            }

            var cell = Cells[idx];
            cell.EntitiesCount = entities.Count;
            cell.Glyph = entities.Select(e => e.Glyph).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) ?? string.Empty;
            var types = entities
                .Select(e => e.Type)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (types.Length > 0)
            {
                cell.EntityTypes = new ObservableCollection<string>(types);
            }
        }

        SyncGridStatus(state);
        ApplyGridRender(state);

        BuildGridActionsIndex(state);
        foreach (var cell in Cells)
        {
            var key = GridCellKey.From(cell);
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

        RefreshCanExecute();
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

    private sealed record GridEntity(int X, int Y, int? OwnerId, string Type, string Glyph);

    private static Dictionary<string, List<GridEntity>> TryReadGridEntities(GameStateDto state)
    {
        var dict = new Dictionary<string, List<GridEntity>>(StringComparer.OrdinalIgnoreCase);
        try
        {
            if (state.Extras.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !grid.TryGetProperty("entities", out var entities) ||
                entities.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                return dict;
            }

            foreach (var item in entities.EnumerateArray())
            {
                if (item.ValueKind != System.Text.Json.JsonValueKind.Object)
                {
                    continue;
                }

                var x = item.TryGetProperty("x", out var xNode) && xNode.TryGetInt32(out var xi) ? xi : int.MinValue;
                var y = item.TryGetProperty("y", out var yNode) && yNode.TryGetInt32(out var yi) ? yi : int.MinValue;
                if (x == int.MinValue || y == int.MinValue)
                {
                    continue;
                }

                int? ownerId = null;
                if (item.TryGetProperty("ownerId", out var oNode) &&
                    oNode.ValueKind == System.Text.Json.JsonValueKind.Number &&
                    oNode.TryGetInt32(out var oi))
                {
                    ownerId = oi;
                }

                var type = item.TryGetProperty("type", out var tNode) && tNode.ValueKind == System.Text.Json.JsonValueKind.String
                    ? (tNode.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                var glyph = item.TryGetProperty("glyph", out var gNode) && gNode.ValueKind == System.Text.Json.JsonValueKind.String
                    ? (gNode.GetString() ?? string.Empty)
                    : string.Empty;

                var key = GridCellKey.From(x, y);
                if (!dict.TryGetValue(key, out var list))
                {
                    list = new List<GridEntity>();
                    dict[key] = list;
                }

                list.Add(new GridEntity(x, y, ownerId, type, glyph));
            }
        }
        catch
        {
            // ignore
        }

        return dict;
    }

    private static bool TryParseCellKey(string raw, out int x, out int y)
    {
        x = 0;
        y = 0;
        var parts = (raw ?? string.Empty).Split(',');
        if (parts.Length != 2)
        {
            return false;
        }

        return int.TryParse(parts[0], out x) && int.TryParse(parts[1], out y);
    }
}
