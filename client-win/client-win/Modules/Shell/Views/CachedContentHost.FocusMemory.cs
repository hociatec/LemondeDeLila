using System;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Input;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void OnGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
    {
        try
        {
            if (_current == null)
            {
                return;
            }

            if (e.NewFocus is not DependencyObject focused)
            {
                return;
            }

            var root = CachedContentHostVisualTree.TryGetPresenterRoot(_current.Presenter);
            if (root == null)
            {
                return;
            }

            if (!CachedContentHostVisualTree.IsDescendantOrSelf(focused, root))
            {
                return;
            }

            if (e.NewFocus is not IInputElement input)
            {
                return;
            }

            if (focused is FrameworkElement fe)
            {
                if (string.Equals(fe.Name, "RootHost", StringComparison.Ordinal) ||
                    string.Equals(fe.Name, "FocusSentinel", StringComparison.Ordinal))
                {
                    return;
                }
            }

            _lastFocusByContent.Remove(_current.Content);
            _lastFocusByContent.Add(
                _current.Content,
                new WeakReference<IInputElement>(input));
        }
        catch
        {
            // best-effort
        }
    }

    private bool TryRestoreLastFocus(object content, DependencyObject expectedRoot)
    {
        try
        {
            if (!_lastFocusByContent.TryGetValue(content, out var weak) || weak == null)
            {
                return false;
            }

            if (!weak.TryGetTarget(out var target) || target == null)
            {
                return false;
            }

            if (target is not DependencyObject dep)
            {
                return false;
            }

            if (PresentationSource.FromDependencyObject(dep) == null)
            {
                return false;
            }

            if (!CachedContentHostVisualTree.IsDescendantOrSelf(dep, expectedRoot))
            {
                return false;
            }

            if (target is UIElement ui)
            {
                if (!ui.IsVisible || !ui.IsEnabled)
                {
                    return false;
                }

                try { ui.Focus(); } catch { /* ignore */ }
            }

            try { Keyboard.Focus(target); } catch { /* ignore */ }
            return CachedContentHostVisualTree.IsFocusWithin(expectedRoot);
        }
        catch
        {
            return false;
        }
    }

    private sealed class ReferenceEqualityComparer : IEqualityComparer<object>
    {
        public static readonly ReferenceEqualityComparer Instance = new();
        public new bool Equals(object? x, object? y) => ReferenceEquals(x, y);
        public int GetHashCode(object obj) => RuntimeHelpers.GetHashCode(obj);
    }
}
