using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.ViewModels;
using client_win.Modules.Game.Play.Grid.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private void OnGridLoaded(object sender, RoutedEventArgs e)
    {
        HookGridGenerator();
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (TryFocusPreferredGridCell())
            {
                _pendingInitialInteractiveFocus = false;
            }
        }));
    }

    private void HookGridGenerator()
    {
        UnhookGridGenerator();
        _gridGeneratorStatusChanged = (_, __) =>
        {
            if (GridItems.ItemContainerGenerator.Status != GeneratorStatus.ContainersGenerated)
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
            {
                if (TryFocusPreferredGridCell())
                {
                    _pendingInitialInteractiveFocus = false;
                }
            }));
        };
        GridItems.ItemContainerGenerator.StatusChanged += _gridGeneratorStatusChanged;
    }

    private void UnhookGridGenerator()
    {
        if (_gridGeneratorStatusChanged != null)
        {
            try
            {
                GridItems.ItemContainerGenerator.StatusChanged -= _gridGeneratorStatusChanged;
            }
            catch
            {
                // best-effort
            }
            _gridGeneratorStatusChanged = null;
        }
    }

    private void OnGridPreviewKeyDown(object sender, KeyEventArgs e)
    {
        HandleGridArrowKey(e);
        if (e.Handled)
        {
            return;
        }

        HandleGridWallPlacementKey(e);
    }

    private void HandleGridArrowKey(KeyEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        if (!vm.Grid.IsVisible || vm.Grid.Size <= 0 || vm.Grid.Cells.Count == 0)
        {
            return;
        }

        // Quand le focus n'est pas déjà dans une case, la première flèche doit amener sur la grille.
        if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            var focused = GetFocusedGridCell();
            if (focused == null)
            {
                // Même si les containers ne sont pas encore générés, on consomme la touche
                // et on planifie un focus sur la grille (sinon le focus WPF tombe sur un "data item").
                TryFocusPreferredGridCell();
                e.Handled = true;
                return;
            }

            var x = focused.X;
            var y = focused.Y;
            switch (e.Key)
            {
                case Key.Left: x--; break;
                case Key.Right: x++; break;
                case Key.Up: y--; break;
                case Key.Down: y++; break;
            }

            x = Math.Clamp(x, 0, vm.Grid.Size - 1);
            y = Math.Clamp(y, 0, vm.Grid.Size - 1);
            var idx = y * vm.Grid.Size + x;
            if (FocusGridCellIndex(idx))
            {
                e.Handled = true;
            }
        }
    }

    private void HandleGridWallPlacementKey(KeyEventArgs e)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        if (!vm.Grid.IsVisible || vm.Grid.Size <= 0 || vm.Grid.Cells.Count == 0)
        {
            return;
        }

        if ((Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None)
        {
            return;
        }

        // Generic: open the list of actions available on the focused cell (uses server-provided _ui hints when present).
        if (e.Key is Key.M)
        {
            var focused = GetFocusedGridCell();
            if (focused == null)
            {
                return;
            }

            e.Handled = true;
            _ = vm.Grid.TryExecuteFocusedCellActionsAsync("M", focused);
        }
    }

    private bool TryFocusPreferredGridCell()
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return false;
        }
        if (!vm.Grid.IsVisible || vm.Grid.Size <= 0 || vm.Grid.Cells.Count == 0)
        {
            return false;
        }

        var preferred =
            vm.Grid.Cells.FirstOrDefault(c => c.HasOwnPawn) ??
            vm.Grid.Cells.FirstOrDefault(c => c.HasEntities) ??
            vm.Grid.Cells.FirstOrDefault();
        var idx = preferred?.Index ?? 0;
        if (idx < 0 || idx >= vm.Grid.Cells.Count)
        {
            idx = 0;
        }
        return FocusGridCellIndex(idx);
    }

    private GridCellViewModel? GetFocusedGridCell()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (focused is FrameworkElement fe && fe.DataContext is GridCellViewModel cell)
            {
                _gridFocusIndex = cell.Index;
                return cell;
            }
            focused = VisualTreeHelper.GetParent(focused);
        }
        return null;
    }

    private bool FocusGridCellIndex(int index)
    {
        if (DataContext is not GamePlayViewModel vm)
        {
            return false;
        }
        if (index < 0 || index >= vm.Grid.Cells.Count)
        {
            return false;
        }

        _gridFocusIndex = index;
        var requestId = ++_gridFocusRequestId;
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (TryFocusGridCellIndexNow(index, requestId))
            {
                UnhookGridFocusObservers();
                return;
            }

            HookGridFocusObservers(index, requestId);
        }));

        return true;
    }

    private bool TryFocusGridCellIndexNow(int index, int requestId)
    {
        if (requestId != _gridFocusRequestId)
        {
            return false;
        }

        if (GridItems == null || GridItems.Visibility != Visibility.Visible)
        {
            return false;
        }

        if (DataContext is not GamePlayViewModel vm || !vm.Grid.IsVisible || vm.Grid.Size <= 0 || vm.Grid.Cells.Count == 0)
        {
            return false;
        }

        index = Math.Clamp(index, 0, vm.Grid.Cells.Count - 1);

        if (GridItems.ItemContainerGenerator.Status != GeneratorStatus.ContainersGenerated)
        {
            return false;
        }

        var container = GridItems.ItemContainerGenerator.ContainerFromIndex(index) as DependencyObject;
        if (container == null)
        {
            return false;
        }

        var button = FindVisualChild<Button>(container) ?? container as Button;
        if (button == null)
        {
            return false;
        }

        button.Focus();
        Keyboard.Focus(button);
        return true;
    }

    private void HookGridFocusObservers(int index, int requestId)
    {
        if (GridItems == null)
        {
            return;
        }

        UnhookGridFocusObservers();

        _gridFocusGeneratorStatusChanged = (_, _) =>
        {
            if (requestId != _gridFocusRequestId)
            {
                UnhookGridFocusObservers();
                return;
            }

            if (TryFocusGridCellIndexNow(index, requestId))
            {
                UnhookGridFocusObservers();
            }
        };

        _gridFocusLayoutUpdated = (_, _) =>
        {
            if (requestId != _gridFocusRequestId)
            {
                UnhookGridFocusObservers();
                return;
            }

            if (TryFocusGridCellIndexNow(index, requestId))
            {
                UnhookGridFocusObservers();
            }
        };

        GridItems.ItemContainerGenerator.StatusChanged += _gridFocusGeneratorStatusChanged;
        GridItems.LayoutUpdated += _gridFocusLayoutUpdated;
    }

    private void UnhookGridFocusObservers()
    {
        if (GridItems == null)
        {
            return;
        }

        try
        {
            if (_gridFocusGeneratorStatusChanged != null)
            {
                GridItems.ItemContainerGenerator.StatusChanged -= _gridFocusGeneratorStatusChanged;
            }

            if (_gridFocusLayoutUpdated != null)
            {
                GridItems.LayoutUpdated -= _gridFocusLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _gridFocusGeneratorStatusChanged = null;
            _gridFocusLayoutUpdated = null;
        }
    }

    private static T? FindVisualChild<T>(DependencyObject parent) where T : DependencyObject
    {
        var count = VisualTreeHelper.GetChildrenCount(parent);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(parent, i);
            if (child is T typed) return typed;
            var sub = FindVisualChild<T>(child);
            if (sub != null) return sub;
        }
        return null;
    }
}
