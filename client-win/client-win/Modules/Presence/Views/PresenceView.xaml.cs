using System;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Presence.ViewModels;

namespace client_win.Modules.Presence.Views;

public partial class PresenceView : UserControl
{
    private PresenceViewModel? _viewModel;
    private int _focusRequestId;

    public PresenceView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        FocusCurrentPage();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (_viewModel != null)
        {
            _viewModel.FocusFirstItemRequested -= OnFocusFirstItemRequested;
            _viewModel = null;
        }

        if (e.NewValue is PresenceViewModel vm)
        {
            _viewModel = vm;
            vm.FocusFirstItemRequested += OnFocusFirstItemRequested;
        }
    }

    private void OnFocusFirstItemRequested()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (ItemsList != null && ItemsList.Items.Count > 0)
            {
                // Forcer un changement de sélection pour déclencher l'annonce SR
                // quand on entre dans une page (sinon il faut parfois appuyer sur ↓).
                ItemsList.SelectedIndex = -1;
                ItemsList.SelectedIndex = 0;
                ItemsList.ScrollIntoView(ItemsList.Items[0]);
            }
            RequestFocusSelectedOrFirstItem();
        }));
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
            vm.HandleEscape();
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusCurrentPage));
        }
    }

    private async void OnListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not PresenceViewModel vm)
        {
            return;
        }
        e.Handled = true;
        await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
        RequestFocusSelectedOrFirstItem();
    }

    private void OnListKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
        }
    }

    private void FocusCurrentPage()
    {
        if (ItemsList != null && ItemsList.IsVisible)
        {
            RequestFocusSelectedOrFirstItem();
            return;
        }

        Focus();
    }

    private void RequestFocusSelectedOrFirstItem()
    {
        var id = ++_focusRequestId;
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.ApplicationIdle,
            new Action(() => FocusSelectedOrFirstItemWithRetry(requestId: id, attemptsRemaining: 12)));

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
                    DispatcherPriority.ApplicationIdle,
                    new Action(() => FocusSelectedOrFirstItemWithRetry(requestId: id, attemptsRemaining: 12)));
            };
            ItemsList.ItemContainerGenerator.StatusChanged += handler;
        }
    }

    private void FocusSelectedOrFirstItemWithRetry(int requestId, int attemptsRemaining)
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

        if (ItemsList.SelectedIndex >= 0 && ItemsList.SelectedIndex < ItemsList.Items.Count)
        {
            ItemsList.ScrollIntoView(ItemsList.Items[ItemsList.SelectedIndex]);
        }

        ItemsList.UpdateLayout();
        if (ItemsList.SelectedIndex >= 0 &&
            ItemsList.ItemContainerGenerator.ContainerFromIndex(ItemsList.SelectedIndex) is ListBoxItem item)
        {
            // Certaines configs WPF + virtualisation + SR "accrochent" mieux si le ListBox reçoit d'abord le focus.
            ItemsList.Focus();
            item.IsSelected = true;
            item.Focus();
            item.BringIntoView();
            RaiseAutomationFocusChanged(item);
            return;
        }

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.ApplicationIdle,
                new Action(() => FocusSelectedOrFirstItemWithRetry(requestId, attemptsRemaining - 1)));
            return;
        }

        ItemsList.Focus();
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
}
