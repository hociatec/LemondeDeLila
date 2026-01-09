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

        return GamePlayUiPanelsParser.TryGetPanelMessage(state, panelId.Trim(), out var message)
            ? message
            : string.Empty;
    }

    internal static string BuildPositionHistoryMessage(GameStateDto state) =>
        GamePlayUiPanelsParser.TryGetPanelMessage(state, "position", out var message)
            ? message
            : string.Empty;
}

