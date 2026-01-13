using System;
using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Actions.ViewModels;

internal static class GamePlayActionsTextBuilder
{
    internal static string Build(GameStateDto state)
    {
        // If the server provides a pending panel, that becomes the primary UI for the turn/setup.
        // Keep the client generic: do not try to interpret per-game controls here.
        if (!string.IsNullOrWhiteSpace(state.Pending?.Type))
        {
            return string.Empty;
        }

        var actions = state.Actions ?? new();
        if (actions.Count == 0)
        {
            // Certains jeux exposent les actions uniquement dans extras.grid.cellActions (indexées par case).
            try
            {
                if (state.Extras.ValueKind == JsonValueKind.Object &&
                    state.Extras.TryGetProperty("grid", out var grid) &&
                    grid.ValueKind == JsonValueKind.Object &&
                    grid.TryGetProperty("cellActions", out var cellActions) &&
                    cellActions.ValueKind == JsonValueKind.Object)
                {
                    var types = cellActions.EnumerateObject()
                        .SelectMany(p =>
                            p.Value.ValueKind == JsonValueKind.Array
                                ? p.Value.EnumerateArray()
                                : Enumerable.Empty<JsonElement>())
                        .Where(e => e.ValueKind == JsonValueKind.Object)
                        .Select(e =>
                            e.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String
                                ? (t.GetString() ?? string.Empty).Trim()
                                : string.Empty)
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(s => s, StringComparer.OrdinalIgnoreCase)
                        .ToArray();

                    if (types.Length > 0)
                    {
                        return $"Actions disponibles via la grille : {string.Join(", ", types)}.";
                    }
                }
            }
            catch
            {
                // ignore
            }

            return "Aucune action disponible (serveur).";
        }

        return string.Join(
            Environment.NewLine,
            actions
                .Where(a => !string.IsNullOrWhiteSpace(a.Type))
                .Where(a => !string.Equals(a.Type.Trim(), "interface", StringComparison.OrdinalIgnoreCase))
                .Select(a =>
                {
                    var label = string.IsNullOrWhiteSpace(a.Label) ? null : a.Label.Trim();
                    return label == null ? $"- {a.Type}" : $"- {a.Type} : {label}";
                }));
    }
}
