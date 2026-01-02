using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Settings.ViewModels;

namespace client_win.Modules.Settings.Views;

public partial class OptionsView : UserControl
{
    private bool _didInitialFocus;
    private bool _didHookFocusRetention;

    public OptionsView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookCheckboxFocusRetention();

        if (_didInitialFocus)
        {
            return;
        }
        _didInitialFocus = true;

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FocusFirstItem(CategoryList);
        }));
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
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
            vm.CancelCommand.Execute(null);
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

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
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

            // Visual tree is more reliable for Slider thumbs/templates.
            var parent = VisualTreeHelper.GetParent(current);
            current = parent ?? LogicalTreeHelper.GetParent(current);
        }
        return null;
    }

    private static void FocusFirstItem(ListBox? listBox)
    {
        if (listBox == null)
        {
            return;
        }

        if (listBox.Items.Count == 0)
        {
            listBox.Focus();
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
}
