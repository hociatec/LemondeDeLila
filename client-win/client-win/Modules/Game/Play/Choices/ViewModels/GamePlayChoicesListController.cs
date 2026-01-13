using System;
using System.Collections.ObjectModel;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesListController
{
    private readonly ObservableCollection<string> _choices;
    private readonly Func<int> _getSelectedIndex;
    private readonly Action<int> _setSelectedIndex;

    internal GamePlayChoicesListController(
        ObservableCollection<string> choices,
        Func<int> getSelectedIndex,
        Action<int> setSelectedIndex)
    {
        _choices = choices ?? throw new ArgumentNullException(nameof(choices));
        _getSelectedIndex = getSelectedIndex ?? throw new ArgumentNullException(nameof(getSelectedIndex));
        _setSelectedIndex = setSelectedIndex ?? throw new ArgumentNullException(nameof(setSelectedIndex));
    }

    internal void Apply(IReadOnlyList<string> next)
    {
        if (AreSame(_choices, next))
        {
            EnsureSelection();
            return;
        }

        _choices.Clear();
        foreach (var choice in next)
        {
            _choices.Add(choice);
        }

        EnsureSelection();
    }

    internal void Clear()
    {
        if (_choices.Count > 0)
        {
            _choices.Clear();
        }
        _setSelectedIndex(-1);
    }

    private void EnsureSelection()
    {
        if (_choices.Count <= 0)
        {
            _setSelectedIndex(-1);
            return;
        }

        var idx = _getSelectedIndex();
        if (idx < 0 || idx >= _choices.Count)
        {
            idx = 0;
        }

        _setSelectedIndex(idx);
    }

    private static bool AreSame(ObservableCollection<string> existing, IReadOnlyList<string> next)
    {
        if (existing.Count != next.Count)
        {
            return false;
        }

        for (var i = 0; i < existing.Count; i++)
        {
            if (!string.Equals(existing[i], next[i], StringComparison.Ordinal))
            {
                return false;
            }
        }

        return true;
    }
}
