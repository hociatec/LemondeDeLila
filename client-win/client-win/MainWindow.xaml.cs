using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace client_win;

public partial class MainWindow : Window
{
    private int _focusNudgeAttempts;
    private const int MaxFocusNudgeAttempts = 6;
    private int _didApplyInitialWindowState;

    public MainWindow()
    {
        InitializeComponent();

        Loaded += (_, _) =>
        {
            ApplyInitialWindowState();
            ScheduleFocusNudge();
        };
        ContentRendered += (_, _) =>
        {
            ApplyInitialWindowState();
            ScheduleFocusNudge();
        };
        Activated += (_, _) =>
        {
            ApplyInitialWindowState();
            ScheduleFocusNudge();
        };
    }

    private void ApplyInitialWindowState()
    {
        // Ne pas maximiser dans le constructeur : selon le mode de lancement, cela peut arriver
        // avant que la fenêtre soit réellement activée, et on perd ensuite le focus clavier.
        // En le faisant sur Loaded/ContentRendered/Activated, on force un vrai "state change"
        // proche du comportement "agrandir" qui débloque l'interaction chez NVDA.
        if (System.Threading.Interlocked.Exchange(ref _didApplyInitialWindowState, 1) == 1)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Render, new Action(() =>
        {
            try
            {
                if (WindowState != WindowState.Maximized)
                {
                    WindowState = WindowState.Maximized;
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void ScheduleFocusNudge()
    {
        if (_focusNudgeAttempts >= MaxFocusNudgeAttempts)
        {
            return;
        }

        _focusNudgeAttempts++;

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(EnsureKeyboardFocusInContent));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(EnsureKeyboardFocusInContent));
    }

    private void EnsureKeyboardFocusInContent()
    {
        try
        {
            if (!IsVisible || !IsLoaded || !IsActive)
            {
                return;
            }

            if (HasUsableFocusWithinRoot())
            {
                return;
            }

            try { RootHost?.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(RootHost); } catch { /* ignore */ }
            try { RootHost?.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); } catch { /* ignore */ }

            if (HasUsableFocusWithinRoot())
            {
                return;
            }

            // Fallback: start from the window.
            try { Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(this); } catch { /* ignore */ }
            try { MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); } catch { /* ignore */ }
        }
        catch
        {
            // best-effort
        }
    }

    private bool HasUsableFocusWithinRoot()
    {
        try
        {
            if (RootHost == null)
            {
                return false;
            }

            if (Keyboard.FocusedElement is not DependencyObject focused)
            {
                return false;
            }

            if (ReferenceEquals(focused, RootHost) || ReferenceEquals(focused, FocusSentinel) || ReferenceEquals(focused, this))
            {
                return false;
            }

            if (!IsDescendant(focused, RootHost))
            {
                return false;
            }

            if (focused is not UIElement uie)
            {
                return false;
            }

            return uie.IsVisible && uie.IsEnabled && uie.IsHitTestVisible;
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private static bool IsDescendant(DependencyObject node, DependencyObject ancestor)
    {
        for (DependencyObject? current = node; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, ancestor))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetParent(DependencyObject current)
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
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }
}
