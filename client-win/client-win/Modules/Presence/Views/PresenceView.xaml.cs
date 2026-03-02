using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Presence.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Presence.Views;

public partial class PresenceView : UserControl, IInitialFocusTarget
{
    private PresenceViewModel? _viewModel;
    private long _lastListAutoFocusTicks;

    public PresenceView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Loaded += (_, _) =>
        {
            try
            {
                if (ItemsList != null)
                {
                    ItemsList.GotKeyboardFocus -= OnItemsListGotKeyboardFocus;
                    ItemsList.GotKeyboardFocus += OnItemsListGotKeyboardFocus;
                }
            }
            catch
            {
                // ignore
            }
        };
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusCurrentPage(FocusPolicyReason.InitialLoad);
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (_viewModel != null)
        {
            _viewModel.FocusFirstItemRequested -= OnFocusFirstItemRequested;
            _viewModel.FocusSelectedItemRequested -= OnFocusSelectedItemRequested;
            _viewModel = null;
        }

        if (e.NewValue is PresenceViewModel vm)
        {
            _viewModel = vm;
            vm.FocusFirstItemRequested += OnFocusFirstItemRequested;
            vm.FocusSelectedItemRequested += OnFocusSelectedItemRequested;
        }
    }

    private void OnFocusFirstItemRequested()
    {
        RunOnUi(() =>
        {
            if (!FocusPolicy.CanFocus(this, FocusPolicyReason.Update))
            {
                return;
            }

            if (ItemsList != null && ItemsList.Items.Count > 0)
            {
                // Forcer un changement de sélection pour déclencher l'annonce SR
                // quand on entre dans une page (sinon il faut parfois appuyer sur ↓).
                ItemsList.SelectedIndex = -1;
                ItemsList.SelectedIndex = 0;
                ItemsList.ScrollIntoView(ItemsList.Items[0]);
            }
            RequestFocusSelectedOrFirstItem(FocusPolicyReason.Update);
        });
    }

    private void OnFocusSelectedItemRequested()
    {
        RunOnUi(() => RequestFocusSelectedOrFirstItem(FocusPolicyReason.Update));
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape && DataContext is PresenceViewModel vm)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    vm.HandleEscape();
                    if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                    {
                        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => FocusCurrentPage(FocusPolicyReason.UserRequest)));
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape && DataContext is PresenceViewModel vmEsc)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    vmEsc.HandleEscape();
                    if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vmEsc))
                    {
                        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => FocusCurrentPage(FocusPolicyReason.UserRequest)));
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not PresenceViewModel vm)
        {
            return;
        }
        e.Handled = true;

        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
        // Sinon l'élément focalisé peut disparaître pendant le KeyDown -> annonce "indisponible".
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
                if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                {
                    RequestFocusSelectedOrFirstItem(FocusPolicyReason.UserRequest);
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
        }
    }

    private void FocusCurrentPage(FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (ItemsList != null && ItemsList.IsVisible)
        {
            RequestFocusSelectedOrFirstItem(reason);
            return;
        }

        Focus();
    }

    private void RequestFocusSelectedOrFirstItem(FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedOrFirstItemNow));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(FocusSelectedOrFirstItemNow));

        // Si la virtualisation retarde la génération des containers, on retente au moment opportun.
        if (ItemsList?.ItemContainerGenerator != null &&
            ItemsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            EventHandler? handler = null;
            handler = (_, __) =>
            {
                if (ItemsList?.ItemContainerGenerator == null)
                {
                    return;
                }

                if (ItemsList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
                {
                    return;
                }

                ItemsList.ItemContainerGenerator.StatusChanged -= handler;
                _ = Dispatcher.BeginInvoke(
                    DispatcherPriority.Loaded,
                    new Action(FocusSelectedOrFirstItemNow));
            };
            ItemsList.ItemContainerGenerator.StatusChanged += handler;
        }
    }

    private void OnItemsListGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        try
        {
            if (ItemsList == null)
            {
                return;
            }

            // If focus lands on the list itself, immediately move it to the selected item
            // so NVDA announces the entry instead of bouncing through a transient "list" focus.
            if (!ReferenceEquals(e.NewFocus, ItemsList))
            {
                return;
            }

            var now = DateTime.UtcNow.Ticks;
            // Simple anti-bounce guard.
            if (_lastListAutoFocusTicks != 0 && (now - _lastListAutoFocusTicks) < TimeSpan.FromSeconds(1).Ticks)
            {
                return;
            }
            _lastListAutoFocusTicks = now;

            RequestFocusSelectedOrFirstItem(FocusPolicyReason.Update);
        }
        catch
        {
            // best-effort
        }
    }

    private void FocusSelectedOrFirstItemNow()
    {
        if (ItemsList == null || ItemsList.Items.Count == 0)
        {
            // Empty list: keep focus on the view itself (stable) rather than the list control.
            try { Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(this); } catch { /* ignore */ }
            return;
        }

        if (ItemsList.SelectedIndex < 0)
        {
            ItemsList.SelectedIndex = 0;
        }

        if (ItemsList.SelectedIndex >= 0 && ItemsList.SelectedIndex < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[ItemsList.SelectedIndex]);
        }

        if (ItemsList.SelectedIndex >= 0 &&
            ItemsList.ItemContainerGenerator.ContainerFromIndex(ItemsList.SelectedIndex) is ListBoxItem item)
        {
            // Certaines configs WPF + virtualisation + SR "accrochent" mieux si le ListBox reçoit d'abord le focus.
            try { ItemsList.Focus(); } catch { /* ignore */ }
            item.IsSelected = true;
            try { item.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(item); } catch { /* ignore */ }
            item.BringIntoView();
            RaiseAutomationFocusChanged(item);
            return;
        }

        try { ItemsList.Focus(); } catch { /* ignore */ }
    }

    private static void RaiseAutomationFocusChanged(UIElement element)
    {
        try
        {
            var peer = UIElementAutomationPeer.FromElement(element) ?? UIElementAutomationPeer.CreatePeerForElement(element);
            peer?.RaiseAutomationEvent(AutomationEvents.AutomationFocusChanged);
        }
        catch
        {
            // Best-effort.
        }
    }

    public void RequestInitialFocus()
    {
        FocusCurrentPage(FocusPolicyReason.InitialLoad);
    }

    private void RunOnUi(Action action)
    {
        if (action == null)
        {
            return;
        }

        if (Dispatcher.CheckAccess())
        {
            action();
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, action);
    }
}
