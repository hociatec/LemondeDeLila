using System;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Panels.Services;

internal static class GamePlayPanelHistoryMessageBuilder
{
    internal static string BuildPanelHistoryMessage(GameStateDto state, string panelId)
    {
        if (state == null || string.IsNullOrWhiteSpace(panelId))
        {
            return string.Empty;
        }

        var normalizedPanelId = panelId.Trim();
        if (string.Equals(normalizedPanelId, "position", StringComparison.OrdinalIgnoreCase))
        {
            if (GamePlayUiPanelsParser.TryGetPanelMessage(state, normalizedPanelId, out var panelMessage) &&
                !string.IsNullOrWhiteSpace(panelMessage))
            {
                return panelMessage;
            }
        }

        return GamePlayUiPanelsParser.TryGetPanelMessage(state, normalizedPanelId, out var message) ? message : string.Empty;
    }

}
