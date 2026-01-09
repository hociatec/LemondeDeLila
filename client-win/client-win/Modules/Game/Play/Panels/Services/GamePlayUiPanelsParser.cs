using System;
using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Panels.Services;

internal static class GamePlayUiPanelsParser
{
    internal static bool TryGetPanelMessage(GameStateDto state, string panelId, out string message)
    {
        message = string.Empty;
        if (state == null || string.IsNullOrWhiteSpace(panelId))
        {
            return false;
        }

        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("ui", out var ui) ||
                ui.ValueKind != JsonValueKind.Object ||
                !ui.TryGetProperty("panels", out var panels) ||
                panels.ValueKind != JsonValueKind.Object ||
                !panels.TryGetProperty(panelId, out var panel) ||
                panel.ValueKind != JsonValueKind.Object ||
                !panel.TryGetProperty("message", out var msgNode) ||
                msgNode.ValueKind != JsonValueKind.String)
            {
                return false;
            }

            var s = msgNode.GetString();
            if (string.IsNullOrWhiteSpace(s))
            {
                return false;
            }

            message = s.Trim();
            return true;
        }
        catch
        {
            return false;
        }
    }
}

