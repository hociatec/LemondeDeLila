using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameZoneHostView : UserControl
{
    public GameZoneHostView()
    {
        InitializeComponent();
    }

    public event EventHandler? TabToHistoryRequested;
    public event EventHandler? StartRequested;

    public void FocusGameZone()
    {
        if (GameZoneHost?.Content == null)
        {
            if (GameZoneEmptyAnchor?.Focus() == true)
            {
                Keyboard.Focus(GameZoneEmptyAnchor);
                return;
            }
        }

        var content = GameZoneHost?.Content;
        if (content != null && GameZoneHost != null)
        {
            try
            {
                GameZoneHost.UpdateLayout();

                // Le ContentControl contient un ViewModel (pas la vue). La vue réelle est créée via DataTemplate.
                // On cherche donc un élément de la vue (dans l'arbre visuel) dont le DataContext = ce ViewModel,
                // puis on le focus pour que les handlers clavier du jeu (GamePlayView) prennent le relais.
                if (FindFocusablePresentedRoot(GameZoneHost, content) is FrameworkElement viewRoot)
                {
                    if (viewRoot.Focus())
                    {
                        Keyboard.Focus(viewRoot);
                        return;
                    }

                    // Fallback: si le root n'est pas focusable, tenter un enfant focusable.
                    if (FindFirstFocusableDescendant(viewRoot) is IInputElement focusableChild)
                    {
                        Keyboard.Focus(focusableChild);
                        (focusableChild as UIElement)?.Focus();
                        return;
                    }
                    return;
                }
            }
            catch
            {
                // best-effort
            }
        }

        if (GameZoneFocusAnchor?.Focus() == true)
        {
            Keyboard.Focus(GameZoneFocusAnchor);
            return;
        }

        GameZoneEmptyAnchor?.Focus();
        Keyboard.Focus(GameZoneEmptyAnchor);
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
        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            StartRequested?.Invoke(this, EventArgs.Empty);
            return;
        }

        // Les flèches ne doivent pas déplacer le focus depuis l'ancre : la navigation est gérée ailleurs.
        if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            e.Handled = true;
            return;
        }

        if (e.Key != Key.Tab)
        {
            return;
        }

        e.Handled = true;
        TabToHistoryRequested?.Invoke(this, EventArgs.Empty);
    }
}
