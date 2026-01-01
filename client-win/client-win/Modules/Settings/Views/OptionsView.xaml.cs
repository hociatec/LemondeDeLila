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

    public OptionsView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        if (_didInitialFocus)
        {
            return;
        }
        _didInitialFocus = true;

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            CategoryList?.Focus();
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
                if (delta <= 0)
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
}
