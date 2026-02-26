using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class TableAmbienceVolumeWindow : Window
{
    public sealed class Vm : INotifyPropertyChanged
    {
        private bool _enabled;
        private int _volume;

        public bool Enabled
        {
            get => _enabled;
            set
            {
                if (_enabled == value) return;
                _enabled = value;
                OnPropertyChanged();
            }
        }

        public int Volume
        {
            get => _volume;
            set
            {
                if (_volume == value) return;
                _volume = value;
                OnPropertyChanged();
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
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
        var safeOwner = ResolveSafeOwner(owner);
        var w = new TableAmbienceVolumeWindow(initialEnabled, initialVolume, onSave)
        {
            Owner = safeOwner,
            WindowStartupLocation = safeOwner != null
                ? WindowStartupLocation.CenterOwner
                : WindowStartupLocation.CenterScreen,
        };
        var previousFocus = Keyboard.FocusedElement;
        FocusParking.Park(safeOwner);
        NvdaDialogFocus.Configure(w, safeOwner, focusTargetFactory: () => w.VolumeSlider);
        w.ShowDialog();
        DialogFocusRestorer.Restore(safeOwner, previousFocus);
    }

    private static Window? ResolveSafeOwner(Window? owner)
    {
        var candidate = owner ?? Application.Current?.MainWindow;
        if (!IsUsableOwner(candidate))
        {
            candidate = Application.Current?.MainWindow;
        }
        return IsUsableOwner(candidate) ? candidate : null;
    }

    private static bool IsUsableOwner(Window? window)
    {
        if (window == null) return false;
        if (!window.IsVisible) return false;
        if (window.WindowState == WindowState.Minimized) return false;

        var bounds = window.RestoreBounds;
        var virtualScreen = new Rect(
            SystemParameters.VirtualScreenLeft,
            SystemParameters.VirtualScreenTop,
            SystemParameters.VirtualScreenWidth,
            SystemParameters.VirtualScreenHeight);
        return bounds.IntersectsWith(virtualScreen);
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
