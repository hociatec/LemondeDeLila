using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Automation.Peers;
using System.Collections.Generic;
using client_win.Modules.Game.Play.Grid.ViewModels;

namespace client_win.Modules.Game.Play.Grid.Views;

public sealed class GridCellsControl : ItemsControl
{
    protected override AutomationPeer OnCreateAutomationPeer() => new GridCellsControlAutomationPeer(this);

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
        cell.IsTabStop = false;
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

    private sealed class GridCellsControlAutomationPeer : ItemsControlAutomationPeer
    {
        public GridCellsControlAutomationPeer(GridCellsControl owner) : base(owner) { }

        protected override ItemAutomationPeer CreateItemAutomationPeer(object item) =>
            new GridCellItemAutomationPeer(item, this);
    }

    private sealed class GridCellItemAutomationPeer : ItemAutomationPeer
    {
        public GridCellItemAutomationPeer(object item, ItemsControlAutomationPeer itemsControlPeer)
            : base(item, itemsControlPeer) { }

        protected override string GetClassNameCore() => nameof(A11yGridCell);

        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Custom;

        protected override string GetLocalizedControlTypeCore() => string.Empty;

        protected override int GetPositionInSetCore() => -1;

        protected override int GetSizeOfSetCore() => -1;

        protected override string GetNameCore()
        {
            var wrapper = TryGetWrapper() as UIElement;
            if (wrapper == null) return string.Empty;
            return AutomationProperties.GetName(wrapper) ?? string.Empty;
        }

        protected override List<AutomationPeer>? GetChildrenCore()
        {
            var wrapper = TryGetWrapper() as UIElement;
            if (wrapper == null) return null;
            var peer = UIElementAutomationPeer.CreatePeerForElement(wrapper);
            return peer == null ? null : new List<AutomationPeer> { peer };
        }

        public override object? GetPattern(PatternInterface patternInterface)
        {
            var wrapper = TryGetWrapper() as UIElement;
            if (wrapper == null) return null;
            var peer = UIElementAutomationPeer.CreatePeerForElement(wrapper);
            return peer?.GetPattern(patternInterface);
        }

        private DependencyObject? TryGetWrapper()
        {
            try
            {
                if (ItemsControlAutomationPeer.Owner is not ItemsControl owner)
                {
                    return null;
                }
                return owner.ItemContainerGenerator.ContainerFromItem(Item);
            }
            catch
            {
                return null;
            }
        }
    }
}
