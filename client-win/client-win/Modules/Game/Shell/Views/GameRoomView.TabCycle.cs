using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView
{
    private bool TryHandleTabCycle(bool isShift)
    {
        return TryHandleTabCycle(isShift, focusedHint: null);
    }

    private bool TryHandleTabCycle(bool isShift, DependencyObject? focusedHint)
    {
        var targets = GetTabCycleTargets();
        if (targets.Count == 0)
        {
            return false;
        }

        if (targets.Count == 1)
        {
            return FocusTabTarget(targets[0]);
        }

        var focused = Keyboard.FocusedElement as DependencyObject
                      ?? focusedHint
                      ?? FocusManager.GetFocusedElement(this) as DependencyObject;
        if (focused == null)
        {
            if (TryRecoverRapidTabTarget(targets, isShift, out var recoveredIndex))
            {
                var recoveredNextIndex = isShift
                    ? (recoveredIndex - 1 + targets.Count) % targets.Count
                    : (recoveredIndex + 1) % targets.Count;
                if (FocusTabTarget(targets[recoveredNextIndex]))
                {
                    RememberTabCycleTarget(targets[recoveredNextIndex]);
                    return true;
                }
            }

            var fallback = isShift ? targets[^1] : targets[0];
            if (FocusTabTarget(fallback))
            {
                RememberTabCycleTarget(fallback);
                return true;
            }

            return false;
        }

        if (HasVisibleInlinePrompt())
        {
            return false;
        }

        var index = GetTargetIndexForFocus(targets, focused);
        if (index < 0 && TryRecoverRapidTabTarget(targets, isShift, out var recoveredIndex2))
        {
            index = recoveredIndex2;
        }

        if (index < 0)
        {
            if (!GameRoomViewFocusTree.IsFocusWithinElement(this, focused))
            {
                return false;
            }

            index = isShift ? 0 : targets.Count - 1;
        }

        var nextIndex = isShift ? (index - 1 + targets.Count) % targets.Count : (index + 1) % targets.Count;
        for (var attempts = 0; attempts < targets.Count; attempts++)
        {
            if (FocusTabTarget(targets[nextIndex]))
            {
                RememberTabCycleTarget(targets[nextIndex]);
                return true;
            }

            nextIndex = isShift
                ? (nextIndex - 1 + targets.Count) % targets.Count
                : (nextIndex + 1) % targets.Count;
        }

        return false;
    }

    private bool TryRecoverRapidTabTarget(IReadOnlyList<TabTarget> targets, bool isShift, out int index)
    {
        index = -1;
        if (!_lastTabCycleTargetKind.HasValue)
        {
            return false;
        }

        if (DateTime.UtcNow - _lastTabCycleAtUtc > RapidTabRecoveryWindow)
        {
            return false;
        }

        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == _lastTabCycleTargetKind.Value)
            {
                index = i;
                return true;
            }
        }

        index = isShift ? 0 : targets.Count - 1;
        return true;
    }

    private void RememberTabCycleTarget(TabTarget target)
    {
        _lastTabCycleAtUtc = DateTime.UtcNow;
        _lastTabCycleTargetKind = target.Kind;
    }

    private bool HasVisibleInlinePrompt()
    {
        if (GameZoneHost == null)
        {
            return false;
        }

        foreach (var playView in FindDescendants<GamePlayView>(GameZoneHost))
        {
            if (playView.FindName("InlinePromptOverlay") is UIElement overlay &&
                overlay.Visibility == Visibility.Visible)
            {
                return true;
            }
        }

        return false;
    }

    private static IEnumerable<T> FindDescendants<T>(DependencyObject root)
        where T : DependencyObject
    {
        if (root == null)
        {
            yield break;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null)
            {
                continue;
            }

            if (child is T typed)
            {
                yield return typed;
            }

            foreach (var descendant in FindDescendants<T>(child))
            {
                yield return descendant;
            }
        }
    }

    private List<TabTarget> GetTabCycleTargets()
    {
        var targets = new List<TabTarget>(4);

        if (GameZoneHost != null && GameZoneHost.IsVisible)
        {
            targets.Add(TabTarget.GameZone(GameZoneHost));
        }

        if (ChatHost?.Visibility == Visibility.Visible && ChatInput != null && IsFocusableTarget(ChatInput))
        {
            targets.Add(TabTarget.Chat(ChatInput));
        }

        var historyTarget = HistoryHost?.FocusTarget ?? (HistoryHost as FrameworkElement);
        if (historyTarget != null && HistoryHost != null && HistoryHost.IsVisible && HistoryHost.IsEnabled)
        {
            targets.Add(TabTarget.History(historyTarget));
        }

        return targets;
    }

    private static bool IsFocusableTarget(FrameworkElement? element)
    {
        if (element == null)
        {
            return false;
        }

        if (!element.IsVisible || !element.IsEnabled)
        {
            return false;
        }

        return element.Focusable || KeyboardNavigation.GetIsTabStop(element);
    }

    private int GetTargetIndexForFocus(IReadOnlyList<TabTarget> targets, DependencyObject focused)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            var root = targets[i].FocusRoot;
            if (root != null && GameRoomViewFocusTree.IsFocusWithinElement(root, focused))
            {
                return i;
            }
        }

        var historyIndex = TryFindHistoryIndex(targets);
        if (historyIndex >= 0 && HistoryHost?.IsKeyboardFocusWithin == true)
        {
            return historyIndex;
        }

        var gameZoneIndex = TryFindGameZoneIndex(targets);
        if (gameZoneIndex >= 0 && IsGameZoneContext(focused))
        {
            return gameZoneIndex;
        }

        return -1;
    }

    private bool FocusTabTarget(TabTarget target)
    {
        if (target.Kind == TabTargetKind.GameZone)
        {
            return FocusGameZone(GameFocusReason.TabCycle) != GameFocusAttemptResult.None;
        }

        if (target.Kind == TabTargetKind.Chat)
        {
            return TryFocusChatInternal();
        }

        if (target.Kind == TabTargetKind.History)
        {
            return TryFocusHistoryInternal();
        }

        if (!IsFocusableTarget(target.Element))
        {
            return false;
        }

        var element = target.Element!;
        if (_focusPolicy != null)
        {
            _focusPolicy.RunInternal(() =>
            {
                TryFocusElement(element);
            });
        }
        else
        {
            TryFocusElement(element);
        }

        return true;
    }

    private int TryFindGameZoneIndex(IReadOnlyList<TabTarget> targets)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == TabTargetKind.GameZone)
            {
                return i;
            }
        }

        return -1;
    }

    private static int TryFindHistoryIndex(IReadOnlyList<TabTarget> targets)
    {
        for (var i = 0; i < targets.Count; i++)
        {
            if (targets[i].Kind == TabTargetKind.History)
            {
                return i;
            }
        }

        return -1;
    }

    private bool IsGameZoneContext(DependencyObject focused)
    {
        if (GameZoneHost != null && (GameZoneHost.IsKeyboardFocusWithin || GameRoomViewFocusTree.IsFocusWithinElement(GameZoneHost, focused)))
        {
            return true;
        }

        var zoneContext = GameZoneHost?.DataContext;
        if (zoneContext == null)
        {
            return false;
        }

        var current = focused as FrameworkElement;
        while (current != null)
        {
            if (ReferenceEquals(current.DataContext, zoneContext))
            {
                return true;
            }

            current = GameRoomViewFocusTree.GetVisualOrLogicalParent(current) as FrameworkElement;
        }

        return false;
    }
}
