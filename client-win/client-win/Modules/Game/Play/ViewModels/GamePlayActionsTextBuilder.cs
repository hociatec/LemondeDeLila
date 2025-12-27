using System;
using System.Linq;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.ViewModels;

internal static class GamePlayActionsTextBuilder
{
    internal static string Build(GameStateDto state)
    {
        var actions = state.Actions ?? new();
        if (actions.Count == 0)
        {
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
