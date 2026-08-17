using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Settings.ViewModels;
using client_win.Modules.Shell.Controls;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.Views;

public partial class OptionsDialog : Window
{
    private bool _didInitialFocus;
    private bool _didHookFocusRetention;
    private int _tabHeaderFocusRequestId;
    private int _categoryOptionFocusRequestId;

    public OptionsDialog()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        HookCheckboxFocusRetention();

        if (_didInitialFocus)
        {
            return;
        }
        _didInitialFocus = true;

        RequestFirstOptionFocusInCurrentCategory();
    }

    private void OnSaveClicked(object sender, RoutedEventArgs e)
    {
        if (DataContext is OptionsViewModel vm && vm.SaveCommand?.CanExecute(null) == true)
        {
            vm.SaveCommand.Execute(null);
        }
    }

    private void OnCancelClicked(object sender, RoutedEventArgs e)
    {
        if (DataContext is OptionsViewModel vm && vm.CancelCommand?.CanExecute(null) == true)
        {
            vm.CancelCommand.Execute(null);
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is Key.Left or Key.Right)
        {
            if (!TryNavigateTabsFromFocusedHeader(e.Key == Key.Right))
            {
                return;
            }

            e.Handled = true;
            return;
        }

        if (e.Key is Key.Up or Key.Down)
        {
            var forward = e.Key == Key.Down;
            var slider = FindAncestorOrSelf<Slider>(Keyboard.FocusedElement as DependencyObject);
            if (slider != null && slider.IsEnabled)
            {
                e.Handled = true;
                var delta = slider.SmallChange;
                if (delta < 1)
                {
                    delta = 1;
                }
                slider.Value = e.Key == Key.Up
                    ? Math.Min(slider.Maximum, slider.Value + delta)
                    : Math.Max(slider.Minimum, slider.Value - delta);
                return;
            }

            if (TryNavigateTabsFromFocusedHeader(forward))
            {
                e.Handled = true;
            }

            return;
        }

        if (e.Key != Key.Escape)
        {
            return;
        }

        if (DataContext is OptionsViewModel vm && vm.CancelCommand?.CanExecute(null) == true)
        {
            e.Handled = true;
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
            {
                try
                {
                    if (DataContext is OptionsViewModel deferredVm &&
                        deferredVm.CancelCommand?.CanExecute(null) == true)
                    {
                        deferredVm.CancelCommand.Execute(null);
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }

    private void OnCategorySelectionChanged(object? sender, SelectionChangedEventArgs e)
    {
        RequestFirstOptionFocusInCurrentCategory();
    }

    private void HookCheckboxFocusRetention()
    {
        if (_didHookFocusRetention)
        {
            return;
        }
        _didHookFocusRetention = true;

        AddHandler(CheckBox.CheckedEvent, new RoutedEventHandler(OnAnyCheckboxToggled), handledEventsToo: true);
        AddHandler(CheckBox.UncheckedEvent, new RoutedEventHandler(OnAnyCheckboxToggled), handledEventsToo: true);
    }

    private void OnAnyCheckboxToggled(object sender, RoutedEventArgs e)
    {
        if (e.OriginalSource is not CheckBox checkbox)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(System.Windows.Threading.DispatcherPriority.Input, new Action(() =>
        {
            if (!checkbox.IsEnabled || !checkbox.IsVisible)
            {
                return;
            }

            checkbox.Focus();
            Keyboard.Focus(checkbox);
        }));
    }

    private static T? FindAncestorOrSelf<T>(DependencyObject? start) where T : DependencyObject
    {
        var current = start;
        while (current != null)
        {
            if (current is T matched)
            {
                return matched;
            }

            var parent = VisualTreeHelper.GetParent(current);
            current = parent ?? LogicalTreeHelper.GetParent(current);
        }

        return null;
    }

    private void FocusTabs()
    {
        if (CategoryTabs == null)
        {
            return;
        }

        CategoryTabs.Focus();
        Keyboard.Focus(CategoryTabs);
    }

    private bool TryNavigateTabs(bool forward)
    {
        if (CategoryTabs == null || CategoryTabs.Items.Count == 0)
        {
            return false;
        }

        var index = CategoryTabs.SelectedIndex;
        if (index < 0)
        {
            index = 0;
        }

        var next = forward ? index + 1 : index - 1;
        if (next < 0 || next >= CategoryTabs.Items.Count)
        {
            RequestFirstOptionFocusInCurrentCategory();
            return true;
        }

        CategoryTabs.SelectedIndex = next;
        RequestFirstOptionFocusInCurrentCategory();
        return true;
    }

    private bool TryNavigateTabsFromFocusedHeader(bool forward)
    {
        if (!IsFocusedOnCategoryHeader())
        {
            return false;
        }

        return TryNavigateTabs(forward);
    }

    private bool IsFocusedOnCategoryHeader()
    {
        if (CategoryTabs == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        if (ReferenceEquals(focused, CategoryTabs))
        {
            return true;
        }

        var focusedListItem = FindAncestorOrSelf<ListBoxItem>(focused);
        if (focusedListItem == null)
        {
            return false;
        }

        return ReferenceEquals(FindAncestorOrSelf<VerticalMenuList>(focusedListItem), CategoryTabs);
    }

    private bool TryFocusFirstOptionInCurrentCategory()
    {
        if (CategoryTabs == null || !IsLoaded || !IsVisible)
        {
            return false;
        }

        EnsureDefaultTabSelected();
        var index = CategoryTabs.SelectedIndex;
        if (index < 0 || index >= CategoryTabs.Items.Count)
        {
            return false;
        }

        if (CategoryTabs.ItemContainerGenerator.ContainerFromIndex(index) is not ListBoxItem tabItem)
        {
            return false;
        }

        var firstCheckbox = FindFirstDescendant<CheckBox>(tabItem);
        if (firstCheckbox != null &&
            firstCheckbox.IsVisible &&
            firstCheckbox.IsEnabled &&
            firstCheckbox.Focusable)
        {
            return TryKeyboardFocus(firstCheckbox);
        }

        var firstButton = FindFirstDescendant<Button>(tabItem);
        if (firstButton != null &&
            firstButton.IsVisible &&
            firstButton.IsEnabled &&
            firstButton.IsTabStop)
        {
            return TryKeyboardFocus(firstButton);
        }

        return false;
    }

    private void RequestFirstOptionFocusInCurrentCategory()
    {
        var requestId = unchecked(++_categoryOptionFocusRequestId);
        RunFirstOptionFocusPass(requestId);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => RunFirstOptionFocusPass(requestId)));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => RunFirstOptionFocusPass(requestId)));
    }

    private void RunFirstOptionFocusPass(int requestId)
    {
        if (requestId != _categoryOptionFocusRequestId)
        {
            return;
        }

        if (!TryFocusFirstOptionInCurrentCategory())
        {
            EnsureDefaultTabSelected();
            FocusSelectedTabHeader();
        }
    }

    private void EnsureDefaultTabSelected()
    {
        if (CategoryTabs == null || CategoryTabs.Items.Count == 0)
        {
            return;
        }

        if (CategoryTabs.SelectedIndex < 0)
        {
            CategoryTabs.SelectedIndex = 0;
        }
    }

    private void FocusSelectedTabHeader()
    {
        if (CategoryTabs == null || CategoryTabs.Items.Count == 0)
        {
            return;
        }

        var index = CategoryTabs.SelectedIndex >= 0 ? CategoryTabs.SelectedIndex : 0;
        if (CategoryTabs.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem tab)
        {
            tab.Focus();
            Keyboard.Focus(tab);
            return;
        }

        FocusTabs();
    }

    private void RequestTabHeaderFocus()
    {
        var requestId = unchecked(++_tabHeaderFocusRequestId);
        RunTabHeaderFocusPass(requestId);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => RunTabHeaderFocusPass(requestId)));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => RunTabHeaderFocusPass(requestId)));
    }

    private void RunTabHeaderFocusPass(int requestId)
    {
        if (requestId != _tabHeaderFocusRequestId)
        {
            return;
        }

        EnsureDefaultTabSelected();
        FocusSelectedTabHeader();
    }

    private static bool TryKeyboardFocus(IInputElement? target)
    {
        if (target == null)
        {
            return false;
        }

        try
        {
            (target as UIElement)?.Focus();
            var current = Keyboard.Focus(target);
            if (ReferenceEquals(current, target))
            {
                return true;
            }
        }
        catch
        {
            return false;
        }

        if (target is UIElement uiElement && uiElement.IsKeyboardFocused)
        {
            return true;
        }

        return false;
    }

    private static T? FindFirstDescendant<T>(DependencyObject? root) where T : DependencyObject
    {
        if (root == null)
        {
            return null;
        }

        if (root is T directMatch)
        {
            return directMatch;
        }

        var childrenCount = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < childrenCount; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            var found = FindFirstDescendant<T>(child);
            if (found != null)
            {
                return found;
            }
        }

        return null;
    }
}
