using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Settings.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.Views;

public partial class OptionsDialog : Window
{
    private bool _didInitialFocus;
    private bool _didHookFocusRetention;

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

        Dispatcher.BeginInvoke((Action)(() =>
        {
            EnsureDefaultTabSelected();
            FocusSelectedTabHeader();
        }), DispatcherPriority.Input);
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
            if (!TryNavigateTabs(e.Key == Key.Right))
            {
                return;
            }

            e.Handled = true;
            return;
        }

        if (e.Key is Key.Up or Key.Down)
        {
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

        CategoryTabs.UpdateLayout();
        CategoryTabs.Focus();
        Keyboard.Focus(CategoryTabs);
    }

    private bool TryNavigateTabs(bool forward)
    {
        if (CategoryTabs == null || CategoryTabs.Items.Count == 0)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        if (FindAncestorOrSelf<Slider>(focused) != null ||
            FindAncestorOrSelf<TextBoxBase>(focused) != null ||
            FindAncestorOrSelf<ComboBox>(focused) != null)
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
            // Bloqué aux extrémités (pas de boucle).
            FocusSelectedTabHeader();
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedTabHeader));
            return true;
        }

        CategoryTabs.SelectedIndex = next;
        FocusSelectedTabHeader();
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusSelectedTabHeader));
        return true;
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

        CategoryTabs.UpdateLayout();
        var index = CategoryTabs.SelectedIndex >= 0 ? CategoryTabs.SelectedIndex : 0;
        if (CategoryTabs.ItemContainerGenerator.ContainerFromIndex(index) is TabItem tab)
        {
            tab.Focus();
            Keyboard.Focus(tab);
            return;
        }

        FocusTabs();
    }
}
