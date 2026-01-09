using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
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
                        var key = (cellProp.Name ?? string.Empty).Trim();
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

            var key = GridCellKey.From(x, y);
            var hasOrientation = action.Payload.TryGetProperty("o", out var oNode) && oNode.ValueKind == JsonValueKind.String;

            var orientation = OrientationValue(action.Payload);
            var label = action.Label ?? string.Empty;
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
                        dict[(key.Trim(), type.Trim(), o)] = label.Trim();
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
}

