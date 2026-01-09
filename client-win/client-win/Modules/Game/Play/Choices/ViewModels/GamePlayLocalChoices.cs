using System;
using System.Collections.Generic;
using client_win.Modules.Game.Play.Actions.Dtos;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayLocalChoices
{
    private readonly Dictionary<string, GameClientAction> _actionsByLabel = new(StringComparer.Ordinal);
    private string _mode = string.Empty;

    internal bool IsMode(string mode) => string.Equals(_mode, mode, StringComparison.OrdinalIgnoreCase);

    internal bool HasChoices => _actionsByLabel.Count > 0;

    internal bool TryGetAction(string label, out GameClientAction action) => _actionsByLabel.TryGetValue(label, out action!);

    internal void Clear()
    {
        _actionsByLabel.Clear();
        _mode = string.Empty;
    }

    internal void Set(string mode, Dictionary<string, GameClientAction> choices)
    {
        _mode = mode;
        _actionsByLabel.Clear();
        foreach (var kv in choices)
        {
            _actionsByLabel[kv.Key] = kv.Value;
        }
    }
}
