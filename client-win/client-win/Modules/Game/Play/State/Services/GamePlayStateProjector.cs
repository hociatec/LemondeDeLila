using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.State.Services;

internal sealed class GamePlayStateProjector
{
    private readonly GameLogCursor _logCursor = new();

    internal void ResetLogCursor() => _logCursor.Reset();

    internal void PrimeLogCursor(GameStateDto? state) => _logCursor.Prime(state);

    internal (List<string> choices, string? selected) ExtractPendingChoices(GameStateDto state)
    {
        var result = new List<string>();
        var raw = state.Pending?.Choices;
        if (raw == null || raw.Count == 0)
        {
            return (result, null);
        }

        foreach (var choice in raw.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()))
        {
            result.Add(choice);
        }

        return (result, result.Count > 0 ? result[0] : null);
    }

    internal IEnumerable<GameLogEntryDto> ExtractNewLogMessages(GameStateDto state) => _logCursor.ExtractNewMessages(state);

    internal bool HasInterfaceShortcut(GameStateDto? state, string id)
    {
        if (state == null) return false;
        if (string.IsNullOrWhiteSpace(id)) return false;
        return GamePlayExtrasParser.ExtractShortcutHints(state).Any(s =>
            string.Equals(s.Type, "interface", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
    }
}
