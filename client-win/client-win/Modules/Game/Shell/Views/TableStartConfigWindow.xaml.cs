using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;

namespace client_win.Modules.Game.Shell.Views;

public partial class TableStartConfigWindow : Window
{
    private sealed class Vm
    {
        public ObservableCollection<TableAmbiencePickerWindow.Choice> Choices { get; } = new();
        public TableAmbiencePickerWindow.Choice? SelectedChoice { get; set; }
    }

    private readonly Vm _vm = new();

    private TableStartConfigWindow(
        IReadOnlyList<TableAmbiencePickerWindow.Choice> choices,
        string? currentSoundId)
    {
        InitializeComponent();
        DataContext = _vm;

        foreach (var c in choices ?? Array.Empty<TableAmbiencePickerWindow.Choice>())
        {
            _vm.Choices.Add(c);
        }

        var current = (currentSoundId ?? string.Empty).Trim();
        _vm.SelectedChoice = _vm.Choices.FirstOrDefault(c => string.Equals(c.SoundId, current, StringComparison.OrdinalIgnoreCase))
                             ?? _vm.Choices.FirstOrDefault();

        Loaded += (_, _) =>
        {
            try { ChoicesList.Focus(); } catch { }
        };
    }

    public static string? Pick(
        Window? owner,
        string? currentSoundId,
        IReadOnlyList<TableAmbiencePickerWindow.Choice> choices)
    {
        var w = new TableStartConfigWindow(choices, currentSoundId) { Owner = owner };
        var ok = w.ShowDialog();
        return ok == true ? (w._vm.SelectedChoice?.SoundId ?? string.Empty) : null;
    }

    private void OnCancelClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OnStartClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }
}

