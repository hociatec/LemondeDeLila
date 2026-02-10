using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class TableAmbiencePickerWindow : Window
{
    public sealed record Choice(string SoundId, string Label)
    {
        public override string ToString() => Label ?? string.Empty;
    }

    private sealed class Vm
    {
        public ObservableCollection<Choice> Choices { get; } = new();
        public Choice? SelectedChoice { get; set; }
    }

    private readonly Vm _vm = new();

    private TableAmbiencePickerWindow(
        IReadOnlyList<Choice> choices,
        string? currentSoundId)
    {
        InitializeComponent();
        DataContext = _vm;

        foreach (var c in choices ?? Array.Empty<Choice>())
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

    public static string? Pick(Window? owner, string? currentSoundId, IReadOnlyList<Choice> choices)
    {
        var w = new TableAmbiencePickerWindow(choices, currentSoundId) { Owner = owner };
        var previousFocus = Keyboard.FocusedElement;
        FocusParking.Park(owner);
        NvdaDialogFocus.Configure(w, owner, focusTargetFactory: () => w.ChoicesList);
        var ok = w.ShowDialog();
        DialogFocusRestorer.Restore(owner, previousFocus);
        return ok == true ? (w._vm.SelectedChoice?.SoundId ?? string.Empty) : null;
    }

    private void OnCancelClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void OnOkClicked(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }
}
