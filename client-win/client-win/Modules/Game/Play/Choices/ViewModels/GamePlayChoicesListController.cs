using System;
using System.Collections.ObjectModel;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesListController
{
    private readonly ObservableCollection<string> _choices;
    private readonly Func<string?> _getSelected;
    private readonly Action<string?> _setSelected;

    internal GamePlayChoicesListController(
        ObservableCollection<string> choices,
        Func<string?> getSelected,
        Action<string?> setSelected)
    {
        _choices = choices ?? throw new ArgumentNullException(nameof(choices));
        _getSelected = getSelected ?? throw new ArgumentNullException(nameof(getSelected));
        _setSelected = setSelected ?? throw new ArgumentNullException(nameof(setSelected));
    }

    internal void Apply(IReadOnlyList<string> next)
    {
        if (AreSame(_choices, next))
        {
            if (_choices.Count > 0 && string.IsNullOrWhiteSpace(_getSelected()))
            {
                _setSelected(_choices[0]);
            }
            return;
        }

        _choices.Clear();
        foreach (var choice in next)
        {
            _choices.Add(choice);
        }

        _setSelected(_choices.Count > 0 ? _choices[0] : null);
    }

    internal void Clear()
    {
        if (_choices.Count > 0)
        {
            _choices.Clear();
        }
        _setSelected(null);
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

