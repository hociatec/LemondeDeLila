using System;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.MainMenu.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.MainMenu.Views;

public partial class MainMenuView : UserControl, IInitialFocusTarget
{
    private long _lastAutoFocusTicks;
    private int _focusRequestId;

    public MainMenuView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusWhenContainersGenerated();
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Enter || e.Key == Key.Return)
        {
            if (DataContext is not MainMenuViewModel vm)
            {
                return;
            }

            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
            {
                try
                {
                    await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }

    private void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (e.IsRepeat)
        {
            e.Handled = true;
            return;
        }
        if (DataContext is not MainMenuViewModel vm)
        {
            return;
        }
        e.Handled = true;

        // Exécuter l'action après l'événement clavier (navigation potentielle = remplacement de vue).
        // NVDA: éviter les stratégies "park focus" locales; le Shell gère la sécurité de focus au moment du swap.
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);

                // Si l'action n'a pas déclenché de navigation (ex: action locale), restaurer le focus sur le menu.
                // Si la navigation a remplacé la vue, éviter de refocaliser un élément qui va disparaître.
                if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                {
                    FocusWhenContainersGenerated();
                }
            }
            catch
            {
                // best-effort
            }
        }));

        return;
    }

    private void FocusFirstItem()
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var id = unchecked(++_focusRequestId);
        FocusSelectedItemWithRetry(id, attemptsRemaining: 8);
    }

    private void FocusSelectedItemWithRetry(int requestId, int attemptsRemaining)
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        var index = ItemsList.SelectedIndex;
        if (index >= 0 && index < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[index]);
        }

        if (index >= 0 && ItemsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            Keyboard.Focus(item);
            return;
        }

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Loaded,
                new Action(() => FocusSelectedItemWithRetry(requestId, attemptsRemaining - 1)));
            return;
        }

        ItemsList.Focus();
    }

    private void OnListGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (ItemsList == null)
        {
            return;
        }

        // Si le focus arrive sur la liste elle-même, le remonter sur l'item sélectionné
        // pour que NVDA annonce directement l'entrée et pas juste "liste".
        if (ReferenceEquals(e.NewFocus, ItemsList))
        {
            var now = Stopwatch.GetTimestamp();
            // Évite un "bégaiement" NVDA si le focus rebondit plusieurs fois sur la liste.
            if (_lastAutoFocusTicks != 0 && now - _lastAutoFocusTicks < Stopwatch.Frequency)
            {
                return;
            }
            _lastAutoFocusTicks = now;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
        }
    }

    private void OnListPreviewGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (ItemsList == null || e.NewFocus is not DependencyObject focused)
        {
            return;
        }

        var container = ItemsControl.ContainerFromElement(ItemsList, focused) as ListBoxItem;
        if (container?.DataContext == null)
        {
            return;
        }

        if (!ReferenceEquals(ItemsList.SelectedItem, container.DataContext))
        {
            ItemsList.SelectedItem = container.DataContext;
        }
    }

    private void FocusWhenContainersGenerated()
    {
        if (ItemsList == null)
        {
            return;
        }

        if (ItemsList.HasItems &&
            ItemsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (ItemsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            ItemsList.ItemContainerGenerator.StatusChanged -= handler;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusFirstItem));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }

    public void RequestInitialFocus()
    {
        FocusWhenContainersGenerated();
    }
}
