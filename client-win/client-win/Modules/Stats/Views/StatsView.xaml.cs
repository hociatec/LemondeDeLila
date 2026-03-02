using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Stats.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Stats.Views;

public partial class StatsView : UserControl, IInitialFocusTarget, IFocusReady
{
    private bool _isFocusReady;

    public StatsView()
    {
        InitializeComponent();
        IsVisibleChanged += OnIsVisibleChanged;
    }

    public bool IsFocusReady => _isFocusReady;

    public event EventHandler? FocusReadyChanged;

    private void OnIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (IsVisible != true)
        {
            return;
        }

        UpdateFocusReady();

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            try
            {
                if (!IsVisible || IsKeyboardFocusWithin)
                {
                    return;
                }

                FocusWhenContainersGenerated(FocusPolicyReason.InitialLoad);
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            if (ItemsList != null)
            {
                ItemsList.ItemContainerGenerator.StatusChanged -= OnItemsContainersStatusChanged;
                ItemsList.ItemContainerGenerator.StatusChanged += OnItemsContainersStatusChanged;
            }
        }
        catch
        {
            // best-effort
        }

        UpdateFocusReady();
        FocusWhenContainersGenerated(FocusPolicyReason.InitialLoad);

        // Defer network calls until the view is visible (UI first).
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                if (DataContext is StatsViewModel vm)
                {
                    await vm.InitializeAsync().ConfigureAwait(true);
                    if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                    {
                        UpdateFocusReady();
                        FocusWhenContainersGenerated(FocusPolicyReason.Update);
                    }
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            return;
        }

        if (e.Key == Key.Escape && DataContext is StatsViewModel vm)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    var result = vm.HandleEscape();
                    if (result != StatsNavResult.Closed &&
                        IsLoaded &&
                        IsVisible &&
                        ReferenceEquals(DataContext, vm))
                    {
                        FocusWhenContainersGenerated(FocusPolicyReason.UserRequest);
                    }
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
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }
        if (DataContext is not StatsViewModel vm)
        {
            return;
        }
        e.Handled = true;

        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
        {
            try
            {
                await vm.ActivateCommand.ExecuteAsync(null).ConfigureAwait(true);
                if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                {
                    FocusWhenContainersGenerated(FocusPolicyReason.UserRequest);
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

    private void FocusFirstItem(FocusPolicyReason reason)
    {
        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        FocusSelectedOrFirstItem();
    }

    private void FocusSelectedOrFirstItem()

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
            return;
        }

        ItemsList.Focus();
    }

    private void FocusWhenContainersGenerated(FocusPolicyReason reason)
    {
        if (ItemsList == null)
        {
            return;
        }

        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (ItemsList.HasItems &&
            ItemsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => FocusFirstItem(reason)));
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
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => FocusFirstItem(reason)));
        };
        ItemsList.ItemContainerGenerator.StatusChanged += handler;
    }

    public void RequestInitialFocus()
    {
        FocusWhenContainersGenerated(FocusPolicyReason.InitialLoad);
    }

    private void OnItemsContainersStatusChanged(object? sender, EventArgs e)
    {
        UpdateFocusReady();
    }

    private void UpdateFocusReady()
    {
        try
        {
            var ready = ComputeFocusReady();
            if (ready == _isFocusReady)
            {
                return;
            }

            _isFocusReady = ready;
            FocusReadyChanged?.Invoke(this, EventArgs.Empty);
        }
        catch
        {
            // best-effort
        }
    }

    private bool ComputeFocusReady()
    {
        if (!IsLoaded || !IsVisible)
        {
            return false;
        }

        if (ItemsList == null)
        {
            return false;
        }

        if (ItemsList.Items.Count == 0)
        {
            return true;
        }

        return ItemsList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated;
    }
}
