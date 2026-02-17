using System;
using System.Collections.Generic;
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

    internal void Apply(IReadOnlyList<string> next, bool autoSelectFirst = true)
    {
        next ??= Array.Empty<string>();
        var previousSelection = _getSelectedIndex();
        var previousSelectedValue =
            previousSelection >= 0 && previousSelection < _choices.Count
                ? _choices[previousSelection]
                : null;

        ApplyDiff(next);
        EnsureSelection(autoSelectFirst, previousSelection, previousSelectedValue);
    }

    internal void Clear()
    {
        if (_choices.Count > 0)
        {
            _choices.Clear();
        }
        _setSelectedIndex(-1);
    }

    private void EnsureSelection(
        bool autoSelectFirst,
        int previousSelection,
        string? previousSelectedValue)
    {
        if (_choices.Count <= 0)
        {
            _setSelectedIndex(-1);
            return;
        }

        var idx = -1;
        if (!string.IsNullOrWhiteSpace(previousSelectedValue))
        {
            idx = IndexOf(_choices, previousSelectedValue!);
        }

        if (idx < 0 && previousSelection >= 0 && previousSelection < _choices.Count)
        {
            idx = previousSelection;
        }

        if (idx < 0 || idx >= _choices.Count)
        {
            if (!autoSelectFirst)
            {
                _setSelectedIndex(-1);
                return;
            }

            idx = 0;
        }

        _setSelectedIndex(idx);
    }

    private void ApplyDiff(IReadOnlyList<string> next)
    {
        var shared = Math.Min(_choices.Count, next.Count);
        for (var i = 0; i < shared; i++)
        {
            if (!string.Equals(_choices[i], next[i], StringComparison.Ordinal))
            {
                _choices[i] = next[i];
            }
        }

        for (var i = _choices.Count - 1; i >= next.Count; i--)
        {
            _choices.RemoveAt(i);
        }

        for (var i = _choices.Count; i < next.Count; i++)
        {
            _choices.Add(next[i]);
        }
    }

    private static int IndexOf(IEnumerable<string> items, string value)
    {
        var index = 0;
        foreach (var item in items)
        {
            if (string.Equals(item, value, StringComparison.Ordinal))
            {
                return index;
            }

            index++;
        }

        return -1;
    }
}
