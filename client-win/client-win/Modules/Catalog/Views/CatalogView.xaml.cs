using System.Windows;
using System.Windows.Controls;
using client_win.Modules.Catalog.ViewModels;
using System.Windows.Threading;
using System.Windows.Input;
using System;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Catalog.Views;

public partial class CatalogView : UserControl, IInitialFocusTarget, IFocusReady
{
    private enum CatalogLayoutMode
    {
        Wide,
        Medium,
        Narrow
    }

    private const double CatalogLayoutMediumBreakpoint = 1300;
    private const double CatalogLayoutNarrowBreakpoint = 980;
    private CatalogLayoutMode _layoutMode = CatalogLayoutMode.Wide;
    private int _enterFromCategoriesRequestId;
    private bool _isFocusReady;
    private EventHandler? _focusNextFromCategoriesSubStatusChanged;
    private EventHandler? _focusNextFromCategoriesGamesStatusChanged;
    private EventHandler? _focusNextFromCategoriesLayoutUpdated;

    public CatalogView()
    {
        InitializeComponent();

        // With CachedContentHost, views can be hidden/shown without being unloaded/reloaded.
        // Ensure we restore a usable keyboard focus when the tavern becomes visible again (e.g. after Vault/JoinGame).
        IsVisibleChanged += OnIsVisibleChanged;
        Unloaded += (_, _) => UnhookFocusNextFromCategoriesObservers();
    }

    public bool IsFocusReady => _isFocusReady;

    public event EventHandler? FocusReadyChanged;

    internal bool IsCategoriesColumnFocused => CategoriesList?.IsKeyboardFocusWithin == true;

    internal bool IsSubCategoriesColumnFocused => SubCategoriesList?.IsKeyboardFocusWithin == true;

    internal void FocusAfterEscapeFromShell(CatalogEscapeResult result) => FocusAfterEscape(result);

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

                FocusWhenContainersGenerated(CategoriesList, FocusPolicyReason.InitialLoad);
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        ApplyResponsiveLayout(ActualWidth);

        try
        {
            if (CategoriesList != null)
            {
                CategoriesList.ItemContainerGenerator.StatusChanged -= OnCategoriesContainersStatusChanged;
                CategoriesList.ItemContainerGenerator.StatusChanged += OnCategoriesContainersStatusChanged;
            }
        }
        catch
        {
            // best-effort
        }

        UpdateFocusReady();
        // À l'entrée dans la taverne, le focus doit être sur la liste principale (actions + catégories).
        Dispatcher.BeginInvoke(DispatcherPriority.Input, () => FocusWhenContainersGenerated(CategoriesList, FocusPolicyReason.InitialLoad));
    }

    private void OnSizeChanged(object sender, SizeChangedEventArgs e)
    {
        if (!IsLoaded)
        {
            return;
        }

        // Ignore micro-resizes triggered by layout rounding.
        if (Math.Abs(e.PreviousSize.Width - e.NewSize.Width) < 0.5)
        {
            return;
        }

        ApplyResponsiveLayout(e.NewSize.Width);
        UpdateFocusReady();
    }

    private void OnKeyDown(object sender, System.Windows.Input.KeyEventArgs e)
    {
        if (e.Key == System.Windows.Input.Key.Tab)
        {
            e.Handled = true;
            return;
        }
        if (e.Key == System.Windows.Input.Key.Escape && DataContext is CatalogViewModel vm)
        {
            e.Handled = true;
            var inCategoriesColumn = CategoriesList?.IsKeyboardFocusWithin == true;
            var inSubCategoriesColumn = SubCategoriesList?.IsKeyboardFocusWithin == true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    var result = vm.HandleEscape(inCategoriesColumn, inSubCategoriesColumn);
                    if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                    {
                        // Repositionner le focus après navigation
                        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                        {
                            FocusAfterEscape(result);
                        }));
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled)
        {
            return;
        }

        if (e.Key != Key.Escape || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // Preview => fiable même si un contrôle enfant absorbe KeyDown.
        e.Handled = true;
        var inCategoriesColumn = CategoriesList?.IsKeyboardFocusWithin == true;
        var inSubCategoriesColumn = SubCategoriesList?.IsKeyboardFocusWithin == true;
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                var result = vm.HandleEscape(inCategoriesColumn, inSubCategoriesColumn);
                if (IsLoaded && IsVisible && ReferenceEquals(DataContext, vm))
                {
                    _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        FocusAfterEscape(result);
                    }));
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void OnListPreviewGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (sender is not ListBox list || e.NewFocus is not DependencyObject focused)
        {
            return;
        }

        var container = ItemsControl.ContainerFromElement(list, focused) as ListBoxItem;
        if (container?.DataContext == null)
        {
            return;
        }

        if (!ReferenceEquals(list.SelectedItem, container.DataContext))
        {
            list.SelectedItem = container.DataContext;
        }
    }

    private void OnCategoriesKeyDown(object sender, KeyEventArgs e)
    {
        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        if (vm.TryActivateSelectedShelfAction())
        {
            e.Handled = true;
            return;
        }

        // Force propagation vers sous-catégories ou jeux.
        // If the user presses Enter quickly after changing selection, subcategories/games may not be populated yet.
        // Wait for UI updates using event hooks instead of delay/polling loops.
        if (SubCategoriesList?.HasItems != true && GamesList?.HasItems != true)
        {
            e.Handled = true;
            RequestFocusNextFromCategoriesWhenReady(vm);
            return;
        }

        if (SubCategoriesList?.HasItems == true)
        {
            SubCategoriesList.SelectedIndex = SubCategoriesList.SelectedIndex >= 0 ? SubCategoriesList.SelectedIndex : 0;
            vm.SelectedSubShelf = SubCategoriesList.SelectedItem as Modules.Catalog.Models.CatalogCategory;
            FocusFirstItem(SubCategoriesList);
        }
        else if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as Modules.Catalog.Models.CatalogGame;
            FocusFirstItem(GamesList);
        }
        e.Handled = true;
    }

    private void RequestFocusNextFromCategoriesWhenReady(CatalogViewModel vm)
    {
        var requestId = unchecked(++_enterFromCategoriesRequestId);
        if (TryFocusNextFromCategoriesNow(vm))
        {
            UnhookFocusNextFromCategoriesObservers();
            return;
        }

        UnhookFocusNextFromCategoriesObservers();
        _focusNextFromCategoriesSubStatusChanged = (_, _) =>
        {
            if (requestId != _enterFromCategoriesRequestId)
            {
                UnhookFocusNextFromCategoriesObservers();
                return;
            }

            if (TryFocusNextFromCategoriesNow(vm))
            {
                UnhookFocusNextFromCategoriesObservers();
            }
        };

        _focusNextFromCategoriesGamesStatusChanged = (_, _) =>
        {
            if (requestId != _enterFromCategoriesRequestId)
            {
                UnhookFocusNextFromCategoriesObservers();
                return;
            }

            if (TryFocusNextFromCategoriesNow(vm))
            {
                UnhookFocusNextFromCategoriesObservers();
            }
        };

        _focusNextFromCategoriesLayoutUpdated = (_, _) =>
        {
            if (requestId != _enterFromCategoriesRequestId)
            {
                UnhookFocusNextFromCategoriesObservers();
                return;
            }

            if (TryFocusNextFromCategoriesNow(vm))
            {
                UnhookFocusNextFromCategoriesObservers();
            }
        };

        try
        {
            if (SubCategoriesList != null)
            {
                SubCategoriesList.ItemContainerGenerator.StatusChanged += _focusNextFromCategoriesSubStatusChanged;
            }
        }
        catch { /* ignore */ }
        try
        {
            if (GamesList != null)
            {
                GamesList.ItemContainerGenerator.StatusChanged += _focusNextFromCategoriesGamesStatusChanged;
            }
        }
        catch { /* ignore */ }
        LayoutUpdated += _focusNextFromCategoriesLayoutUpdated;
    }

    private bool TryFocusNextFromCategoriesNow(CatalogViewModel vm)
    {
        if (SubCategoriesList?.HasItems == true)
        {
            SubCategoriesList.SelectedIndex = SubCategoriesList.SelectedIndex >= 0 ? SubCategoriesList.SelectedIndex : 0;
            vm.SelectedSubShelf = SubCategoriesList.SelectedItem as Modules.Catalog.Models.CatalogCategory;
            FocusWhenContainersGenerated(SubCategoriesList);
            return true;
        }

        if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as Modules.Catalog.Models.CatalogGame;
            FocusWhenContainersGenerated(GamesList);
            return true;
        }

        return false;
    }

    private void UnhookFocusNextFromCategoriesObservers()
    {
        try
        {
            if (_focusNextFromCategoriesSubStatusChanged != null)
            {
                if (SubCategoriesList != null)
                {
                    SubCategoriesList.ItemContainerGenerator.StatusChanged -= _focusNextFromCategoriesSubStatusChanged;
                }
            }
            if (_focusNextFromCategoriesGamesStatusChanged != null)
            {
                if (GamesList != null)
                {
                    GamesList.ItemContainerGenerator.StatusChanged -= _focusNextFromCategoriesGamesStatusChanged;
                }
            }
            if (_focusNextFromCategoriesLayoutUpdated != null)
            {
                LayoutUpdated -= _focusNextFromCategoriesLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _focusNextFromCategoriesSubStatusChanged = null;
            _focusNextFromCategoriesGamesStatusChanged = null;
            _focusNextFromCategoriesLayoutUpdated = null;
        }
    }

    private void OnSubCategoriesKeyDown(object sender, KeyEventArgs e)
    {
        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // Si la liste est vide (souvent après Esc), recharger puis attendre que WPF matérialise les conteneurs.
        if (GamesList?.HasItems != true && vm.SelectedSubShelf != null)
        {
            e.Handled = true;
            vm.ReloadGamesForCurrentSelection();
            FocusWhenContainersGenerated(GamesList);
            return;
        }

        if (GamesList?.HasItems == true)
        {
            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
            vm.SelectedGame = GamesList.SelectedItem as Modules.Catalog.Models.CatalogGame;
            FocusFirstItem(GamesList);
            e.Handled = true;
        }
    }

	    private void OnGamesKeyDown(object sender, KeyEventArgs e)
	    {
	        if ((e.Key != Key.Enter && e.Key != Key.Return) || DataContext is not CatalogViewModel vm)
	        {
	            return;
	        }

	        e.Handled = true;

	        // Garantit que la sélection VM est à jour avant activation (évite un "Enter" qui ne fait rien).
	        if (GamesList?.HasItems == true)
	        {
	            GamesList.SelectedIndex = GamesList.SelectedIndex >= 0 ? GamesList.SelectedIndex : 0;
	            vm.SelectedGame = GamesList.SelectedItem as CatalogGame;
	        }
	
	        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
	        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
	        {
	            try
	            {
	                await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
	            }
	            catch
	            {
	                // best-effort
	            }
	        }));
	    }

	    private void OnGamesPreviewKeyDown(object sender, KeyEventArgs e)
	    {
        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (DataContext is not CatalogViewModel vm)
        {
            return;
        }

	        e.Handled = true;

	        if (GamesList?.HasItems == true)
	        {
            if (GamesList.SelectedIndex < 0)
            {
                GamesList.SelectedIndex = 0;
            }
            vm.SelectedGame = GamesList.SelectedItem as CatalogGame;
	        }
	
	        // IMPORTANT (NVDA): exécuter l'action après l'événement clavier.
	        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () =>
	        {
	            try
	            {
	                await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
	            }
	            catch
	            {
	                // best-effort
	            }
	        }));
	    }

    private async void OnGamesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is not CatalogViewModel vm)
        {
            return;
        }

        // S'assure que l'item double-cliqué est bien sélectionné avant activation.
        if (GamesList != null && e.OriginalSource is DependencyObject source)
        {
            var container = ItemsControl.ContainerFromElement(GamesList, source) as ListBoxItem;
            if (container?.DataContext is CatalogGame clicked)
            {
                GamesList.SelectedItem = clicked;
                vm.SelectedGame = clicked;
            }
        }

        await vm.ActivateSelectedGameAsync().ConfigureAwait(true);
    }

    private void FocusAfterEscape(CatalogEscapeResult result)
    {
        switch (result)
        {
            case CatalogEscapeResult.ToSubCategory:
                FocusFirstItem(SubCategoriesList, FocusPolicyReason.UserRequest);
                break;
            case CatalogEscapeResult.ToCategory:
                FocusFirstItem(CategoriesList, FocusPolicyReason.UserRequest);
                break;
            case CatalogEscapeResult.Closed:
                return;
            default:
                FocusFirstItem(CategoriesList, FocusPolicyReason.UserRequest);
                break;
        }
    }

    private void FocusFirstItem(ListBox? listBox, FocusPolicyReason reason = FocusPolicyReason.Update)
    {
        if (listBox == null || listBox.Items.Count == 0)
        {
            return;
        }

        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (listBox.SelectedIndex < 0)
        {
            listBox.SelectedIndex = 0;
        }

        listBox.UpdateLayout();
        if (listBox.ItemContainerGenerator.ContainerFromIndex(listBox.SelectedIndex) is ListBoxItem item)
        {
            item.Focus();
        }
        else
        {
            listBox.Focus();
        }
    }

    private void FocusWhenContainersGenerated(ListBox? listBox, FocusPolicyReason reason = FocusPolicyReason.Update)
    {
        if (listBox == null)
        {
            return;
        }

        if (!FocusPolicy.CanFocus(this, reason))
        {
            return;
        }

        if (listBox.HasItems && listBox.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            FocusFirstItem(listBox, reason);
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (listBox.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            listBox.ItemContainerGenerator.StatusChanged -= handler;

            // Execute après la mise à jour de layout pour garantir ContainerFromIndex.
            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                if (listBox.HasItems)
                {
            FocusFirstItem(listBox, reason);
                }
            }));
        };
        listBox.ItemContainerGenerator.StatusChanged += handler;
    }

    public void RequestInitialFocus()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FocusWhenContainersGenerated(CategoriesList, FocusPolicyReason.InitialLoad);
        }));
    }

    private void ApplyResponsiveLayout(double width)
    {
        if (PanelsGrid == null || CategoriesPanel == null || SubCategoriesPanel == null || GamesPanel == null)
        {
            return;
        }

        var nextMode = width < CatalogLayoutNarrowBreakpoint
            ? CatalogLayoutMode.Narrow
            : width < CatalogLayoutMediumBreakpoint
                ? CatalogLayoutMode.Medium
                : CatalogLayoutMode.Wide;

        if (_layoutMode == nextMode && PanelsGrid.ColumnDefinitions.Count > 0 && PanelsGrid.RowDefinitions.Count > 0)
        {
            return;
        }

        _layoutMode = nextMode;
        PanelsGrid.ColumnDefinitions.Clear();
        PanelsGrid.RowDefinitions.Clear();

        switch (nextMode)
        {
            case CatalogLayoutMode.Wide:
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(2, GridUnitType.Star) });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

                Grid.SetColumn(CategoriesPanel, 0);
                Grid.SetRow(CategoriesPanel, 0);
                Grid.SetColumnSpan(CategoriesPanel, 1);
                Grid.SetRowSpan(CategoriesPanel, 1);

                Grid.SetColumn(SubCategoriesPanel, 1);
                Grid.SetRow(SubCategoriesPanel, 0);
                Grid.SetColumnSpan(SubCategoriesPanel, 1);
                Grid.SetRowSpan(SubCategoriesPanel, 1);

                Grid.SetColumn(GamesPanel, 2);
                Grid.SetRow(GamesPanel, 0);
                Grid.SetColumnSpan(GamesPanel, 1);
                Grid.SetRowSpan(GamesPanel, 1);
                break;

            case CatalogLayoutMode.Medium:
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.4, GridUnitType.Star) });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

                Grid.SetColumn(CategoriesPanel, 0);
                Grid.SetRow(CategoriesPanel, 0);
                Grid.SetColumnSpan(CategoriesPanel, 1);
                Grid.SetRowSpan(CategoriesPanel, 1);

                Grid.SetColumn(SubCategoriesPanel, 0);
                Grid.SetRow(SubCategoriesPanel, 1);
                Grid.SetColumnSpan(SubCategoriesPanel, 1);
                Grid.SetRowSpan(SubCategoriesPanel, 1);

                Grid.SetColumn(GamesPanel, 1);
                Grid.SetRow(GamesPanel, 0);
                Grid.SetColumnSpan(GamesPanel, 1);
                Grid.SetRowSpan(GamesPanel, 2);
                break;

            default:
                PanelsGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
                PanelsGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

                Grid.SetColumn(CategoriesPanel, 0);
                Grid.SetRow(CategoriesPanel, 0);
                Grid.SetColumnSpan(CategoriesPanel, 1);
                Grid.SetRowSpan(CategoriesPanel, 1);

                Grid.SetColumn(SubCategoriesPanel, 0);
                Grid.SetRow(SubCategoriesPanel, 1);
                Grid.SetColumnSpan(SubCategoriesPanel, 1);
                Grid.SetRowSpan(SubCategoriesPanel, 1);

                Grid.SetColumn(GamesPanel, 0);
                Grid.SetRow(GamesPanel, 2);
                Grid.SetColumnSpan(GamesPanel, 1);
                Grid.SetRowSpan(GamesPanel, 1);
                break;
        }
    }

    private void OnCategoriesContainersStatusChanged(object? sender, EventArgs e)
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

        if (CategoriesList == null)
        {
            return false;
        }

        if (CategoriesList.Items.Count == 0)
        {
            return true;
        }

        return CategoriesList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated;
    }
}
