using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using client_win.Modules.Audio.Models;
using client_win.Modules.Audio.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class TableStartConfigWindow : Window
{
    public sealed record StartFlowResult(
        string AmbienceSoundId,
        string GameConfigActionType,
        Dictionary<string, object>? GameConfigPayload);

    private sealed class Vm : INotifyPropertyChanged
    {
        private bool _isAmbienceStep = true;

        public ObservableCollection<TableAmbiencePickerWindow.Choice> Choices { get; } = new();
        public TableAmbiencePickerWindow.Choice? SelectedChoice { get; set; }

        public ObservableCollection<ConfigFieldVm> ConfigFields { get; } = new();
        public bool HasGameConfig => ConfigFields.Count > 0;
        public string GameConfigTitle { get; set; } = "Configuration du jeu";

        public bool IsAmbienceStep
        {
            get => _isAmbienceStep;
            set
            {
                if (_isAmbienceStep == value) return;
                _isAmbienceStep = value;
                OnPropertyChanged();
                OnPropertyChanged(nameof(IsGameConfigStep));
                OnPropertyChanged(nameof(StepTitle));
                OnPropertyChanged(nameof(StepDescription));
            }
        }

        public bool IsGameConfigStep => !IsAmbienceStep;

        public string StepTitle => IsAmbienceStep ? "Configuration de la table" : GameConfigTitle;

        public string StepDescription => IsAmbienceStep
            ? "Avant de démarrer, choisissez l'ambiance de la table."
            : (HasGameConfig
                ? "Ajustez la configuration du jeu, puis démarrez."
                : "Aucune configuration de jeu requise. Vous pouvez démarrer.");

        public event PropertyChangedEventHandler? PropertyChanged;

        public void NotifyConfigChanged()
        {
            OnPropertyChanged(nameof(HasGameConfig));
            OnPropertyChanged(nameof(StepTitle));
            OnPropertyChanged(nameof(StepDescription));
        }

        private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
            => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    private sealed class ConfigFieldVm
    {
        public ConfigFieldVm(string key, string label, string kind, int? min, int? max, string initialText)
        {
            Key = key;
            Label = label;
            Kind = kind;
            Min = min;
            Max = max;
            Text = initialText;
            BoolValue = ParseBool(initialText);
        }

        public string Key { get; }
        public string Label { get; }
        public string Kind { get; }
        public int? Min { get; }
        public int? Max { get; }
        public string Text { get; set; }
        public bool BoolValue { get; set; }

        public bool IsBool =>
            string.Equals(Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(Kind, "boolean", StringComparison.OrdinalIgnoreCase);

        private static bool ParseBool(string? text)
        {
            var v = (text ?? string.Empty).Trim().ToLowerInvariant();
            return v is "true" or "1" or "oui" or "yes" or "on";
        }
    }

    private readonly Vm _vm = new();
    private readonly ISoundService? _sounds;
    private readonly Func<Task<TableGameConfigWindow.Prompt?>>? _loadGameConfigPromptAsync;
    private StartFlowResult? _result;
    private string _gameConfigActionType = string.Empty;

    private TableStartConfigWindow(
        IReadOnlyList<TableAmbiencePickerWindow.Choice> choices,
        string? currentSoundId,
        ISoundService? sounds,
        TableGameConfigWindow.Prompt? gameConfigPrompt,
        Func<Task<TableGameConfigWindow.Prompt?>>? loadGameConfigPromptAsync)
    {
        InitializeComponent();
        DataContext = _vm;
        _sounds = sounds;
        _loadGameConfigPromptAsync = loadGameConfigPromptAsync;

        foreach (var c in choices ?? Array.Empty<TableAmbiencePickerWindow.Choice>())
        {
            _vm.Choices.Add(c);
        }

        var current = (currentSoundId ?? string.Empty).Trim();
        _vm.SelectedChoice = _vm.Choices.FirstOrDefault(c => string.Equals(c.SoundId, current, StringComparison.OrdinalIgnoreCase))
                             ?? _vm.Choices.FirstOrDefault();

        BindGameConfig(gameConfigPrompt);
        BuildConfigFieldsUi();
        UpdateFooterButtons();

        Loaded += (_, _) =>
        {
            try { ChoicesList.Focus(); } catch { }
        };

        Deactivated += (_, _) => StopPreview();
        Closed += (_, _) => StopPreview();
    }

    public static StartFlowResult? PickStartFlow(
        Window? owner,
        string? currentSoundId,
        IReadOnlyList<TableAmbiencePickerWindow.Choice> choices,
        TableGameConfigWindow.Prompt? gameConfigPrompt,
        Func<Task<TableGameConfigWindow.Prompt?>>? loadGameConfigPromptAsync = null,
        ISoundService? soundService = null)
    {
        var safeOwner = ResolveSafeOwner(owner);
        var w = new TableStartConfigWindow(choices, currentSoundId, soundService, gameConfigPrompt, loadGameConfigPromptAsync)
        {
            Owner = safeOwner,
            WindowStartupLocation = safeOwner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
        };

        var previousFocus = Keyboard.FocusedElement;
        FocusParking.Park(safeOwner);
        NvdaDialogFocus.Configure(w, safeOwner, focusTargetFactory: () => w.ChoicesList);
        var ok = w.ShowDialog();
        DialogFocusRestorer.Restore(safeOwner, previousFocus);

        return ok == true ? w._result : null;
    }

    private void BindGameConfig(TableGameConfigWindow.Prompt? prompt)
    {
        _gameConfigActionType = (prompt?.ActionType ?? string.Empty).Trim();
        _vm.ConfigFields.Clear();
        if (prompt == null || prompt.Fields == null || prompt.Fields.Count == 0)
        {
            _vm.GameConfigTitle = "Configuration du jeu";
            _vm.NotifyConfigChanged();
            return;
        }

        _vm.GameConfigTitle = string.IsNullOrWhiteSpace(prompt.Title) ? "Configuration du jeu" : prompt.Title.Trim();
        foreach (var f in prompt.Fields)
        {
            var key = (f.Key ?? string.Empty).Trim();
            if (key.Length == 0) continue;
            _vm.ConfigFields.Add(new ConfigFieldVm(
                key,
                string.IsNullOrWhiteSpace(f.Label) ? key : f.Label.Trim(),
                (f.Kind ?? "text").Trim(),
                f.Min,
                f.Max,
                f.InitialText ?? string.Empty));
        }

        _vm.NotifyConfigChanged();
    }

    private void BuildConfigFieldsUi()
    {
        ConfigFieldsHost.Children.Clear();

        if (_vm.ConfigFields.Count == 0)
        {
            ConfigFieldsHost.Children.Add(new TextBlock
            {
                Text = "Aucune configuration de jeu requise.",
                Foreground = System.Windows.Media.Brushes.White,
                Margin = new Thickness(0, 8, 0, 0)
            });
            return;
        }

        foreach (var field in _vm.ConfigFields)
        {
            var block = new StackPanel { Margin = new Thickness(0, 6, 0, 6) };
            ConfigFieldsHost.Children.Add(block);

            if (field.IsBool)
            {
                var cb = new CheckBox { Content = field.Label, IsChecked = field.BoolValue, Foreground = System.Windows.Media.Brushes.White };
                cb.Checked += (_, _) => field.BoolValue = true;
                cb.Unchecked += (_, _) => field.BoolValue = false;
                block.Children.Add(cb);
                continue;
            }

            block.Children.Add(new TextBlock { Text = field.Label, Foreground = System.Windows.Media.Brushes.White, Margin = new Thickness(0, 0, 0, 4) });
            var tb = new TextBox { Text = field.Text ?? string.Empty, MinWidth = 560 };
            tb.TextChanged += (_, _) => field.Text = tb.Text ?? string.Empty;
            block.Children.Add(tb);
        }
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

    private void OnWindowPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled)
        {
            return;
        }

        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            OnCancelClicked(this, new RoutedEventArgs());
            return;
        }

        if (e.Key is Key.Enter or Key.Return)
        {
            e.Handled = true;
            if (_vm.IsAmbienceStep)
            {
                OnNextClicked(this, new RoutedEventArgs());
            }
            else
            {
                OnStartClicked(this, new RoutedEventArgs());
            }
        }
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

    private void OnPreviousClicked(object sender, RoutedEventArgs e)
    {
        _vm.IsAmbienceStep = true;
        UpdateFooterButtons();
        try { ChoicesList.Focus(); } catch { }
    }

    private async void OnNextClicked(object sender, RoutedEventArgs e)
    {
        if (_vm.ConfigFields.Count == 0 && _loadGameConfigPromptAsync != null)
        {
            try
            {
                var prompt = await _loadGameConfigPromptAsync().ConfigureAwait(true);
                if (prompt != null)
                {
                    BindGameConfig(prompt);
                    BuildConfigFieldsUi();
                }
            }
            catch
            {
                // best-effort
            }
        }

        _vm.IsAmbienceStep = false;
        UpdateFooterButtons();
        FocusFirstConfigInput();
    }

    private void OnStartClicked(object sender, RoutedEventArgs e)
    {
        if (_vm.IsAmbienceStep)
        {
            OnNextClicked(sender, e);
            return;
        }

        var payload = _vm.HasGameConfig ? BuildConfigPayloadOrShowError() : null;
        if (_vm.HasGameConfig && payload == null)
        {
            return;
        }

        StopPreview();
        _result = new StartFlowResult(
            AmbienceSoundId: _vm.SelectedChoice?.SoundId ?? string.Empty,
            GameConfigActionType: _vm.HasGameConfig ? _gameConfigActionType : string.Empty,
            GameConfigPayload: payload);
        DialogResult = true;
        Close();
    }

    private Dictionary<string, object>? BuildConfigPayloadOrShowError()
    {
        var payload = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var field in _vm.ConfigFields)
        {
            if (field.IsBool)
            {
                payload[field.Key] = field.BoolValue;
                continue;
            }

            var text = (field.Text ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                MessageBox.Show(this, $"Veuillez remplir le champ: {field.Label}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            var isNumber = string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase);
            if (!isNumber)
            {
                payload[field.Key] = text;
                continue;
            }

            if (!int.TryParse(text, out var value))
            {
                MessageBox.Show(this, $"Veuillez entrer un nombre pour: {field.Label}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            if (field.Min.HasValue && value < field.Min.Value)
            {
                MessageBox.Show(this, $"Valeur minimale pour {field.Label}: {field.Min.Value}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            if (field.Max.HasValue && value > field.Max.Value)
            {
                MessageBox.Show(this, $"Valeur maximale pour {field.Label}: {field.Max.Value}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            payload[field.Key] = value;
        }

        return payload;
    }

    private void FocusFirstConfigInput()
    {
        foreach (var child in ConfigFieldsHost.Children)
        {
            if (child is StackPanel sp)
            {
                foreach (var inner in sp.Children)
                {
                    if (inner is Control c)
                    {
                        c.Focus();
                        return;
                    }
                }
            }
        }
    }

    private void UpdateFooterButtons()
    {
        if (_vm.IsAmbienceStep)
        {
            PreviousButton.Visibility = Visibility.Collapsed;
            NextButton.Visibility = Visibility.Visible;
            StartButton.Visibility = Visibility.Collapsed;
            return;
        }

        PreviousButton.Visibility = Visibility.Visible;
        NextButton.Visibility = Visibility.Collapsed;
        StartButton.Visibility = Visibility.Visible;
    }

    private void PreviewSelected()
    {
        var selected = ChoicesList.SelectedItem as TableAmbiencePickerWindow.Choice ?? _vm.SelectedChoice;
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
}
