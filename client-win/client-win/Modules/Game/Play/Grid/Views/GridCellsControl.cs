using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using client_win.Modules.Game.Play.Grid.ViewModels;

namespace client_win.Modules.Game.Play.Grid.Views;

public sealed class GridCellsControl : ItemsControl
{
    protected override DependencyObject GetContainerForItemOverride() => new A11yGridCell();

    protected override bool IsItemItsOwnContainerOverride(object item) => item is A11yGridCell;

    protected override void PrepareContainerForItemOverride(DependencyObject element, object item)
    {
        base.PrepareContainerForItemOverride(element, item);

        if (element is not A11yGridCell cell)
        {
            return;
        }

        // Important: GridCellsControl inherits ItemsControl; WPF may push ItemTemplate into ContentTemplate on the container.
        // We own the container content/bindings, so we force templates off to avoid nested visuals.
        cell.ContentTemplate = null;
        cell.ContentTemplateSelector = null;

        cell.FocusVisualStyle = null;
        cell.CommandParameter = item;
        cell.FontSize = 16;
        cell.FontWeight = FontWeights.SemiBold;
        cell.Width = 34;
        cell.Height = 34;
        cell.Padding = new Thickness(0);
        cell.Margin = new Thickness(1);
        cell.Background = new SolidColorBrush(Color.FromRgb(0x10, 0x22, 0x3A));
        cell.BorderBrush = new SolidColorBrush(Color.FromRgb(0x28, 0x4C, 0x75));
        cell.Foreground = Brushes.White;
        AutomationProperties.SetHelpText(cell, string.Empty);

        cell.SetBinding(ContentControl.ContentProperty, new Binding(nameof(GridCellViewModel.Display)));
        cell.SetBinding(AutomationProperties.NameProperty, new Binding(nameof(GridCellViewModel.AccessibleName)));
        cell.SetBinding(Control.BorderThicknessProperty, new Binding(nameof(GridCellViewModel.CellBorderThickness)));
        cell.SetBinding(ButtonBase.CommandProperty, new Binding("DataContext.CellCommand")
        {
            RelativeSource = new RelativeSource(RelativeSourceMode.FindAncestor, typeof(GridCellsControl), 1),
            Mode = BindingMode.OneWay
        });
    }

    protected override void ClearContainerForItemOverride(DependencyObject element, object item)
    {
        if (element is A11yGridCell cell)
        {
            BindingOperations.ClearBinding(cell, ContentControl.ContentProperty);
            BindingOperations.ClearBinding(cell, AutomationProperties.NameProperty);
            BindingOperations.ClearBinding(cell, Control.BorderThicknessProperty);
            BindingOperations.ClearBinding(cell, ButtonBase.CommandProperty);
            cell.CommandParameter = null;
            cell.ContentTemplate = null;
            cell.ContentTemplateSelector = null;
        }

        base.ClearContainerForItemOverride(element, item);
    }
}
