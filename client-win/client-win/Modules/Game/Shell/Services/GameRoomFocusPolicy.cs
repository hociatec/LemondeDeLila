using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Game.Shell.Views;

namespace client_win.Modules.Game.Shell.Services;

internal sealed class GameRoomFocusPolicy
{
    private static readonly TimeSpan UserNavigationWindow = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan HistoryHoldWindow = TimeSpan.FromSeconds(5);

    private readonly GameRoomView _view;
    private bool _attached;
    private KeyboardFocusChangedEventHandler? _focusHandler;
    private MouseButtonEventHandler? _mouseHandler;
    private int _internalFocusDepth;
    private DateTime _lastUserNavigationAtUtc;
    private FocusRegionKind _activeRegion = FocusRegionKind.GameZone;
    private DateTime _historyHoldUntilUtc;

    public GameRoomFocusPolicy(GameRoomView view)
    {
        _view = view ?? throw new ArgumentNullException(nameof(view));
    }

    public void Attach()
    {
        if (_attached)
        {
            return;
        }

        _attached = true;
        _focusHandler = OnGotKeyboardFocus;
        _mouseHandler = OnPreviewMouseDown;

        _view.AddHandler(Keyboard.GotKeyboardFocusEvent, _focusHandler, handledEventsToo: true);
        _view.AddHandler(UIElement.PreviewMouseDownEvent, _mouseHandler, handledEventsToo: true);
    }

    public void Detach()
    {
        if (!_attached)
        {
            return;
        }

        if (_focusHandler != null)
        {
            _view.RemoveHandler(Keyboard.GotKeyboardFocusEvent, _focusHandler);
        }

        if (_mouseHandler != null)
        {
            _view.RemoveHandler(UIElement.PreviewMouseDownEvent, _mouseHandler);
        }

        _focusHandler = null;
        _mouseHandler = null;
        _attached = false;
    }

    public void RunInternal(Action action)
    {
        if (action == null)
        {
            return;
        }

        _internalFocusDepth++;
        try
        {
            action();
        }
        finally
        {
            _internalFocusDepth = Math.Max(0, _internalFocusDepth - 1);
        }
    }

    public T RunInternal<T>(Func<T> action)
    {
        if (action == null)
        {
            return default!;
        }

        _internalFocusDepth++;
        try
        {
            return action();
        }
        finally
        {
            _internalFocusDepth = Math.Max(0, _internalFocusDepth - 1);
        }
    }

    public void NotifyUserKeyDown(Key key)
    {
        if (key == Key.Tab)
        {
            _lastUserNavigationAtUtc = DateTime.UtcNow;
        }
    }

    public bool ShouldAllowGameZoneRequest(GameFocusReason reason)
    {
        if (_view.IsStartWizardOpen)
        {
            return false;
        }

        if (IsHistoryHoldActive())
        {
            return false;
        }

        var activeRegion = ResolveActiveRegion();
        if (activeRegion == FocusRegionKind.GameZone)
        {
            return true;
        }

        return reason is GameFocusReason.TabCycle
            or GameFocusReason.AfterDialog
            or GameFocusReason.InitialLoad;
    }

    public void NotifyHistoryUpdated()
    {
        _historyHoldUntilUtc = DateTime.UtcNow + HistoryHoldWindow;
    }

    public Func<KeyboardFocusChangedEventArgs, bool> AnchorAutoFocusEvaluator => AllowAnchorAutoFocus;

    public bool AllowAnchorAutoFocus(KeyboardFocusChangedEventArgs e)
    {
        if (_view.IsStartWizardOpen)
        {
            return false;
        }

        if (IsHistoryHoldActive())
        {
            return false;
        }

        if (_internalFocusDepth > 0)
        {
            return true;
        }

        if (ResolveActiveRegion() == FocusRegionKind.GameZone)
        {
            return true;
        }

        if (IsUserNavigationRecent())
        {
            return true;
        }

        var oldFocus = e.OldFocus as DependencyObject;
        if (oldFocus != null && _view.GameZoneHost != null &&
            IsFocusWithinElement(_view.GameZoneHost, oldFocus))
        {
            return true;
        }

        return false;
    }

    private void OnPreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        _lastUserNavigationAtUtc = DateTime.UtcNow;
    }

    private void OnGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        var focused = e.NewFocus as DependencyObject;
        if (focused == null)
        {
            return;
        }

        if (IsGameZoneAnchor(focused) && (!AllowAnchorAutoFocus(e) || IsHistoryHoldActive()))
        {
            RestoreActiveRegionFocus();
            return;
        }

        var region = GetRegionForFocus(focused);
        if (region.HasValue)
        {
            _activeRegion = region.Value;
        }
    }

    private FocusRegionKind? GetRegionForFocus(DependencyObject focused)
    {
        if (_view.StartWizardOverlay != null &&
            _view.StartWizardOverlay.Visibility == Visibility.Visible &&
            IsFocusWithinElement(_view.StartWizardOverlay, focused))
        {
            return null;
        }

        if (_view.ChatHost != null && IsFocusWithinElement(_view.ChatHost, focused))
        {
            return FocusRegionKind.Chat;
        }

        if (_view.HistoryHost != null && IsFocusWithinElement(_view.HistoryHost, focused))
        {
            return FocusRegionKind.History;
        }

        if (_view.GameZoneHost != null && IsFocusWithinElement(_view.GameZoneHost, focused))
        {
            return FocusRegionKind.GameZone;
        }

        return null;
    }

    private bool IsUserNavigationRecent()
    {
        return DateTime.UtcNow - _lastUserNavigationAtUtc <= UserNavigationWindow;
    }

    private static bool IsGameZoneAnchor(DependencyObject focused)
    {
        return focused is GameZoneFocusAnchor;
    }

    private void RestoreActiveRegionFocus()
    {
        switch (ResolveActiveRegion())
        {
            case FocusRegionKind.Chat:
                _view.FocusChatInput();
                break;
            case FocusRegionKind.History:
                _view.FocusHistory();
                break;
            case FocusRegionKind.GameZone:
                _view.RequestFocusGameZoneInternal(GameFocusReason.TabCycle);
                break;
        }
    }

    private bool IsHistoryHoldActive()
    {
        if (_view.HistoryHost?.HasRecentInteraction == true)
        {
            return true;
        }

        if (DateTime.UtcNow <= _historyHoldUntilUtc)
        {
            return true;
        }

        if (_view.HistoryHost?.IsHistoryFocused == true)
        {
            return true;
        }

        return ResolveActiveRegion() == FocusRegionKind.History;
    }

    private FocusRegionKind ResolveActiveRegion()
    {
        if (Keyboard.FocusedElement is DependencyObject focused)
        {
            var current = GetRegionForFocus(focused);
            if (current.HasValue)
            {
                _activeRegion = current.Value;
            }
        }

        return _activeRegion;
    }

    private static bool IsFocusWithinElement(DependencyObject root, DependencyObject? focused)
    {
        while (focused != null)
        {
            if (ReferenceEquals(focused, root))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private static DependencyObject? GetVisualOrLogicalParent(DependencyObject current)
    {
        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private enum FocusRegionKind
    {
        GameZone,
        History,
        Chat,
    }
}
