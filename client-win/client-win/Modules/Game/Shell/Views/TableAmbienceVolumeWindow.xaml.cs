using System;
using System.Windows;

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
}

