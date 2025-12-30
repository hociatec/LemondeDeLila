using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Modules.Settings.ViewModels;

namespace client_win.Modules.Settings.Views;

public partial class OptionsDialog : Window
{
    public OptionsDialog()
    {
        InitializeComponent();
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
        if (e.Key is Key.Up or Key.Down)
        {
            var slider = FindAncestorOrSelf<Slider>(Keyboard.FocusedElement as DependencyObject);
            if (slider != null && slider.IsEnabled)
            {
                e.Handled = true;
                var delta = slider.SmallChange;
                if (delta <= 0)
                {
                    delta = 1;
                }
                slider.Value = e.Key == Key.Up
                    ? Math.Min(slider.Maximum, slider.Value + delta)
                    : Math.Max(slider.Minimum, slider.Value - delta);
            }
        }
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
}
