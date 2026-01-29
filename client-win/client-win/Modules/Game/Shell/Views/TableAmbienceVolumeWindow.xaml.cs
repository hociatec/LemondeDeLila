using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Game.Shell.Views;

public partial class TableAmbienceVolumeWindow : Window
{
    private sealed class Vm
    {
        public bool Enabled { get; set; }
        public int Volume { get; set; }
    }

    private readonly Vm _vm = new();
    private readonly Action<bool, int> _onSave;

    private TableAmbienceVolumeWindow(bool initialEnabled, int initialVolume, Action<bool, int> onSave)
    {
        InitializeComponent();
        _onSave = onSave ?? throw new ArgumentNullException(nameof(onSave));
        _vm.Enabled = initialEnabled;
        _vm.Volume = Math.Max(0, Math.Min(100, initialVolume));
        DataContext = _vm;
    }

    public static void Show(Window? owner, bool initialEnabled, int initialVolume, Action<bool, int> onSave)
    {
        var w = new TableAmbienceVolumeWindow(initialEnabled, initialVolume, onSave) { Owner = owner };
        w.ShowDialog();
    }

    private void OnCancelClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OnOkClicked(object sender, RoutedEventArgs e)
    {
        try
        {
            _onSave(_vm.Enabled, Math.Max(0, Math.Min(100, _vm.Volume)));
        }
        catch
        {
            // ignore
        }

        DialogResult = true;
        Close();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            if (VolumeSlider.IsEnabled)
            {
                VolumeSlider.Focus();
            }
        }
        catch
        {
            // ignore
        }
    }

    private void OnVolumeSliderKeyDown(object sender, KeyEventArgs e)
    {
        if (sender is not Slider slider || !slider.IsEnabled)
        {
            return;
        }

        var step = Math.Max(1, (int)Math.Round(slider.TickFrequency));
        if (e.Key == Key.Up)
        {
            slider.Value = Math.Min(slider.Maximum, slider.Value + step);
            e.Handled = true;
        }
        else if (e.Key == Key.Down)
        {
            slider.Value = Math.Max(slider.Minimum, slider.Value - step);
            e.Handled = true;
        }
    }
}
