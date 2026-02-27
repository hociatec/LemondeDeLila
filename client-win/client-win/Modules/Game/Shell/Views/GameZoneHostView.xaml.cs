using System;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameZoneHostView : UserControl
{
    private int _focusRequestId;

    public GameZoneHostView()
    {
        InitializeComponent();
    }

    public event EventHandler? StartRequested;

    public void FocusGameZone()
    {
        FocusGameZone(GameFocusReason.Default);
    }

    public GameFocusAttemptResult FocusGameZone(GameFocusReason reason)
    {
        // Avoid re-focusing the same game zone on frequent state updates:
        // if focus is already within this host, keep it stable.
        if (IsFocusInside(this))
        {
            if (ShouldPreferStartAnchor())
            {
                return GameFocusAttemptResult.Anchor;
            }

            if (IsFocusInside(GameZoneFocusAnchor) || IsFocusInside(GameZoneEmptyAnchor))
            {
                if (GameZoneHost?.Content == null)
                {
                    return GameFocusAttemptResult.Anchor;
                }

                var existingFocusRequestId = Interlocked.Increment(ref _focusRequestId);
                if (TryFocusInteractiveGameContent())
                {
                    return GameFocusAttemptResult.Interactive;
                }

                QueueDeferredFocusAttempt(existingFocusRequestId, DispatcherPriority.Loaded);
                return GameFocusAttemptResult.Anchor;
            }

            return GameZoneHost?.Content == null
                ? GameFocusAttemptResult.Anchor
                : GameFocusAttemptResult.Interactive;
        }

        if (GameZoneHost?.Content == null)
        {
            if (ReferenceEquals(Keyboard.FocusedElement, GameZoneEmptyAnchor))
            {
                return GameFocusAttemptResult.Anchor;
            }

            if (GameZoneEmptyAnchor?.Focus() == true)
            {
                Keyboard.Focus(GameZoneEmptyAnchor);
                return GameFocusAttemptResult.Anchor;
            }

            GameZoneEmptyAnchor?.Focus();
            Keyboard.Focus(GameZoneEmptyAnchor);
            return GameFocusAttemptResult.Anchor;
        }

        if (ShouldPreferStartAnchor())
        {
            FocusGameZoneAnchor();
            return GameFocusAttemptResult.Anchor;
        }

        var requestId = Interlocked.Increment(ref _focusRequestId);
        if (TryFocusInteractiveGameContent())
        {
            return GameFocusAttemptResult.Interactive;
        }

        // Content is set but the visual tree may still be materializing via DataTemplate.
        // Keep a stable anchor immediately, then retry when layout has finished.
        FocusGameZoneAnchor();
        QueueDeferredFocusAttempt(requestId, DispatcherPriority.Loaded);
        return GameFocusAttemptResult.Anchor;
    }

    private void QueueDeferredFocusAttempt(int requestId, DispatcherPriority priority)
    {
        _ = Dispatcher.BeginInvoke(priority, new Action(() =>
        {
            if (requestId != _focusRequestId)
            {
                return;
            }

            if (GameZoneHost?.Content == null)
            {
                return;
            }

            if (TryFocusInteractiveGameContent())
            {
                return;
            }

            FocusGameZoneAnchor();
        }));
    }

    private bool TryFocusInteractiveGameContent()
    {
        var content = GameZoneHost?.Content;
        if (content == null || GameZoneHost == null)
        {
            return false;
        }

        try
        {
            GameZoneHost.UpdateLayout();

            // Le ContentControl contient un ViewModel (pas la vue). La vue reelle est creee via DataTemplate.
            // On cherche donc un element de la vue (dans l'arbre visuel) dont le DataContext = ce ViewModel,
            // puis on le focus pour que les handlers clavier du jeu (GamePlayView) prennent le relais.
            if (FindFocusablePresentedRoot(GameZoneHost, content) is FrameworkElement viewRoot)
            {
                if (viewRoot is IInitialFocusTarget initialFocusTarget)
                {
                    initialFocusTarget.RequestInitialFocus();
                    return IsFocusInside(viewRoot);
                }

                if (viewRoot is GamePlayView gamePlayView)
                {
                    gamePlayView.FocusPreferredInteractiveElement();
                    return IsFocusInside(gamePlayView);
                }

                if (FindDescendant<GamePlayView>(viewRoot) is GamePlayView nestedGamePlayView)
                {
                    nestedGamePlayView.FocusPreferredInteractiveElement();
                    return IsFocusInside(nestedGamePlayView);
                }

                if (viewRoot.Focus())
                {
                    Keyboard.Focus(viewRoot);
                    return IsFocusInside(viewRoot);
                }

                // Fallback: si le root n'est pas focusable, tenter un enfant focusable.
                if (FindFirstFocusableDescendant(viewRoot) is IInputElement focusableChild)
                {
                    Keyboard.Focus(focusableChild);
                    (focusableChild as UIElement)?.Focus();
                    return IsFocusInside(viewRoot);
                }

                return false;
            }
        }
        catch
        {
            // best-effort
        }

        if (FindDescendant<GamePlayView>(GameZoneHost) is GamePlayView fallbackPlayView)
        {
            fallbackPlayView.FocusPreferredInteractiveElement();
            return IsFocusInside(fallbackPlayView);
        }

        return false;
    }

    private static bool IsFocusInside(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
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
            // Ignore visual tree issues and fallback to logical parent.
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private void FocusGameZoneAnchor()
    {
        if (ReferenceEquals(Keyboard.FocusedElement, GameZoneFocusAnchor) ||
            ReferenceEquals(Keyboard.FocusedElement, GameZoneEmptyAnchor))
        {
            return;
        }

        if (ShouldPreferStartAnchor())
        {
            if (GameZoneEmptyAnchor?.Focus() == true)
            {
                Keyboard.Focus(GameZoneEmptyAnchor);
                return;
            }
        }

        if (GameZoneFocusAnchor?.Focus() == true)
        {
            Keyboard.Focus(GameZoneFocusAnchor);
            return;
        }

        if (GameZoneEmptyAnchor?.Focus() == true)
        {
            Keyboard.Focus(GameZoneEmptyAnchor);
            return;
        }

        Keyboard.Focus(GameZoneHost);
    }

    private bool ShouldPreferStartAnchor()
    {
        return DataContext is ViewModels.GameZoneHostViewModel vm && !vm.IsStarted;
    }

    private static FrameworkElement? FindFocusablePresentedRoot(DependencyObject root, object viewModel)
    {
        FrameworkElement? candidate = null;
        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null) continue;

            if (child is FrameworkElement fe &&
                fe.DataContext != null &&
                ReferenceEquals(fe.DataContext, viewModel) &&
                (fe.Focusable || KeyboardNavigation.GetIsTabStop(fe)))
            {
                return fe;
            }

            var nested = FindFocusablePresentedRoot(child, viewModel);
            if (nested != null)
            {
                candidate = nested;
                break;
            }
        }

        return candidate;
    }

    private static T? FindDescendant<T>(DependencyObject root) where T : class
    {
        if (root is T direct)
        {
            return direct;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null) continue;

            var found = FindDescendant<T>(child);
            if (found != null)
            {
                return found;
            }
        }

        return null;
    }

    private static DependencyObject? FindFirstFocusableDescendant(DependencyObject root)
    {
        if (root is Control c && c.IsVisible && c.IsEnabled && (c.Focusable || KeyboardNavigation.GetIsTabStop(c)))
        {
            return c;
        }

        if (root is UIElement u && u.IsVisible && u.IsEnabled && u.Focusable)
        {
            return u;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null) continue;
            var found = FindFirstFocusableDescendant(child);
            if (found != null) return found;
        }

        return null;
    }

    private void OnAnchorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

        if (key is Key.Enter or Key.Return)
        {
            e.Handled = true;
            if (ShouldPreferStartAnchor())
            {
                StartRequested?.Invoke(this, EventArgs.Empty);
                return;
            }

            var requestId = Interlocked.Increment(ref _focusRequestId);
            if (TryFocusInteractiveGameContent())
            {
                return;
            }

            QueueDeferredFocusAttempt(requestId, DispatcherPriority.Loaded);
            return;
        }

        // Les fleches ne doivent pas deplacer le focus depuis l'ancre: la navigation est geree ailleurs.
        if (key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            e.Handled = true;
            return;
        }

        if (key == Key.Tab)
        {
            // Ne pas pieger Tab/Maj+Tab sur l'ancre: laisser la navigation sortir vers chat/historique.
            return;
        }
    }

    private void OnAnchorGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (ShouldPreferStartAnchor() || GameZoneHost?.Content == null)
        {
            return;
        }

        var requestId = Interlocked.Increment(ref _focusRequestId);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (requestId != _focusRequestId)
            {
                return;
            }

            if (TryFocusInteractiveGameContent())
            {
                return;
            }

            QueueDeferredFocusAttempt(requestId, DispatcherPriority.Loaded);
        }));
    }
}
