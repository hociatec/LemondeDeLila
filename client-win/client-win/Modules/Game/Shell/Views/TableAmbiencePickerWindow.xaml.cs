using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
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
    private readonly ISoundService? _sounds;

    private TableAmbiencePickerWindow(
        IReadOnlyList<Choice> choices,
        string? currentSoundId,
        ISoundService? sounds)
    {
        InitializeComponent();
        DataContext = _vm;
        _sounds = sounds;

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

        Deactivated += (_, _) => StopPreview();
        Closed += (_, _) => StopPreview();
    }

    public static string? Pick(
        Window? owner,
        string? currentSoundId,
        IReadOnlyList<Choice> choices,
        ISoundService? soundService = null)
    {
        var w = new TableAmbiencePickerWindow(choices, currentSoundId, soundService) { Owner = owner };
        var previousFocus = Keyboard.FocusedElement;
        FocusParking.Park(owner);
        NvdaDialogFocus.Configure(w, owner, focusTargetFactory: () => w.ChoicesList);
        var ok = w.ShowDialog();
        DialogFocusRestorer.Restore(owner, previousFocus);
        return ok == true ? (w._vm.SelectedChoice?.SoundId ?? string.Empty) : null;
    }

    private void OnChoicesListPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.Key != Key.Space)
        {
            return;
        }

        PreviewSelected();
        e.Handled = true;
    }

    private void OnChoicesListSelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        StopPreview();
    }

    private void OnChoicesListLostKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        StopPreview();
    }

    private void PreviewSelected()
    {
        var selected = ChoicesList.SelectedItem as Choice ?? _vm.SelectedChoice;
        var soundId = (selected?.SoundId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(soundId))
        {
            StopPreview();
            return;
        }

        if (Enum.TryParse<SoundId>(soundId, ignoreCase: true, out var sound))
        {
            try { _sounds?.PlayPreview(sound); } catch { }
            return;
        }

        StopPreview();
    }

    private void StopPreview()
    {
        try { _sounds?.StopPreview(); } catch { }
    }

    private void OnCancelClicked(object sender, RoutedEventArgs e)
    {
        StopPreview();
        DialogResult = false;
        Close();
    }

    private void OnOkClicked(object sender, RoutedEventArgs e)
    {
        StopPreview();
        DialogResult = true;
        Close();
    }
}
