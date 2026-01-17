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
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
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

        // IMPORTANT (NVDA): park focus immediately before a potential navigation.
        // Otherwise the focused ListBoxItem may disappear while still focused -> "indisponible".
        FocusParking.Park();

        // Exécuter l'action après l'événement clavier (navigation potentielle = remplacement de vue).
        // Évite de manipuler le focus vers un "hôte" intermédiaire (souvent annoncé "indisponible" par NVDA).
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
        void FocusItemAtIndex(int index)
        {
            ItemsList.UpdateLayout();
            ItemsList.ScrollIntoView(ItemsList.SelectedItem);
            if (ItemsList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
            }
            else
            {
                ItemsList.Focus();
            }
        }

        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            ItemsList?.Focus();
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        FocusItemAtIndex(ItemsList.SelectedIndex);
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
