using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.MainMenu.Views;

public partial class MainMenuView : UserControl
{
    private List<Button> _orderedButtons = new();
    private string? _lastFocusedButtonName;
    private bool _subscriptionsAttached;

    public MainMenuView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        _orderedButtons = new[]
        {
            CatalogButton,
            JoinButton,
            MessagingButton,
            ChatButton,
            SocialButton,
            AdminButton,
            OptionsButton,
            LogoutButton
        }.Where(b => b != null).ToList();

        if (!_subscriptionsAttached)
        {
            foreach (var button in _orderedButtons)
            {
                button.GotKeyboardFocus += OnButtonGotKeyboardFocus;
            }
            _subscriptionsAttached = true;
        }

        // UX: le menu s'ouvre toujours sur le catalogue, pour que "Entrée" fonctionne immédiatement.
        if (CatalogButton != null && CatalogButton.Visibility == Visibility.Visible && CatalogButton.IsEnabled)
        {
            CatalogButton.Focus();
            _lastFocusedButtonName = CatalogButton.Name;
        }
        else
        {
            FocusLastOrFirstVisibleButton();
        }
    }

    private void OnMenuButtonKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab || e.Key == Key.Left || e.Key == Key.Right)
        {
            e.Handled = true;
            return;
        }

        if (sender is not Button current) return;

        int index = _orderedButtons.IndexOf(current);
        if (index < 0) return;

        if (e.Key == Key.Up)
        {
            e.Handled = true;
            var previous = FindPrevious(index);
            if (previous != null)
            {
                previous.Focus();
            }
        }
        else if (e.Key == Key.Down)
        {
            e.Handled = true;
            var next = FindNext(index);
            if (next != null)
            {
                next.Focus();
            }
        }
    }

    private Button? FindPrevious(int startIndex)
    {
        for (int i = startIndex - 1; i >= 0; i--)
        {
            var candidate = _orderedButtons[i];
            if (candidate.Visibility == Visibility.Visible && candidate.IsEnabled)
            {
                return candidate;
            }
        }
        return null;
    }

    private Button? FindNext(int startIndex)
    {
        for (int i = startIndex + 1; i < _orderedButtons.Count; i++)
        {
            var candidate = _orderedButtons[i];
            if (candidate.Visibility == Visibility.Visible && candidate.IsEnabled)
            {
                return candidate;
            }
        }
        return null;
    }

    private void OnButtonGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (sender is Button b && !string.IsNullOrWhiteSpace(b.Name))
        {
            _lastFocusedButtonName = b.Name;
        }
    }

    private void FocusLastOrFirstVisibleButton()
    {
        var target = _orderedButtons.FirstOrDefault(b =>
            !string.IsNullOrWhiteSpace(_lastFocusedButtonName) &&
            string.Equals(b.Name, _lastFocusedButtonName, StringComparison.Ordinal) &&
            b.Visibility == Visibility.Visible &&
            b.IsEnabled);

        if (target == null)
        {
            target = _orderedButtons.FirstOrDefault(b => b.Visibility == Visibility.Visible && b.IsEnabled);
        }

        target?.Focus();
    }
}
