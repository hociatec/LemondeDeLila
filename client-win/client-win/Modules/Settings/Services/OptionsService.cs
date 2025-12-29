using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Core.Settings;
using client_win.Modules.Settings.Models;
using client_win.Modules.Settings.ViewModels;
using client_win.Modules.Settings.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.Services;

public sealed class OptionsService : IOptionsService
{
    private readonly SettingsManager<OptionsState>? _settingsManager;
    private readonly INavigationService? _navigation;
    private OptionsState _state;

    public OptionsService()
    {
        _state = new OptionsState();
    }

    public OptionsService(SettingsManager<OptionsState> settingsManager)
    {
        _settingsManager = settingsManager ?? throw new ArgumentNullException(nameof(settingsManager));
        _state = _settingsManager.Current;
    }

    public OptionsService(SettingsManager<OptionsState> settingsManager, INavigationService navigation)
    {
        _settingsManager = settingsManager ?? throw new ArgumentNullException(nameof(settingsManager));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _state = _settingsManager.Current;
    }

    public OptionsState Current => _state;

    public void Update(OptionsState state)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));

        if (_settingsManager != null)
        {
            _settingsManager.UpdateAndSave(state);
        }
    }

    public Task<string> OpenAsync()
    {
        var tcs = new TaskCompletionSource<string>();
        Application.Current?.Dispatcher.InvokeAsync(() =>
        {
            if (_navigation == null)
            {
                OpenLegacyDialog(tcs);
                return;
            }

            var previous = _navigation.CurrentView;
            var view = new OptionsView();
            OptionsViewModel? vm = null;

            var clone = CloneState(_state);
            vm = new OptionsViewModel(clone,
                onSave: () =>
                {
                    if (vm != null)
                    {
                        Update(vm.ToState());
                        tcs.TrySetResult("Options mises à jour.");
                    }

                    if (previous != null)
                    {
                        _navigation.Show(previous);
                    }
                },
                onCancel: () =>
                {
                    tcs.TrySetResult("Options annulées.");

                    if (previous != null)
                    {
                        _navigation.Show(previous);
                    }
                });

            view.DataContext = vm;
            _navigation.Show(view);

            if (!tcs.Task.IsCompleted)
            {
                tcs.TrySetResult("Options annulées.");
            }
        });

        return tcs.Task;
    }

    private void OpenLegacyDialog(TaskCompletionSource<string> tcs)
    {
        OptionsViewModel? vm = null;
        var dialog = new OptionsDialog();
        var clone = CloneState(_state);
        vm = new OptionsViewModel(clone,
            onSave: () =>
            {
                if (vm != null)
                {
                    Update(vm.ToState());
                    tcs.TrySetResult("Options mises à jour.");
                }
                dialog.DialogResult = true;
                dialog.Close();
            },
            onCancel: () =>
            {
                tcs.TrySetResult("Options annulées.");
                dialog.DialogResult = false;
                dialog.Close();
            });

        dialog.DataContext = vm;
        dialog.Owner = Application.Current?.MainWindow;
        dialog.ShowDialog();

        if (!tcs.Task.IsCompleted)
        {
            tcs.TrySetResult("Options annulées.");
        }
    }

    private static OptionsState CloneState(OptionsState source) => new()
    {
        MuteAll = source.MuteAll,
        ConfirmExit = source.ConfirmExit,
        SoundAppLaunch = source.SoundAppLaunch,
        SoundAppLaunchVolume = source.SoundAppLaunchVolume,
        SoundBackground = source.SoundBackground,
        SoundBackgroundVolume = source.SoundBackgroundVolume,
        SoundNavigate = source.SoundNavigate,
        SoundNavigateVolume = source.SoundNavigateVolume,
        SoundSelect = source.SoundSelect,
        SoundSelectVolume = source.SoundSelectVolume,
        MusicVolume = source.MusicVolume,
        ChatEnabled = source.ChatEnabled,
        ConfirmChatExit = source.ConfirmChatExit,
        StayConnected = source.StayConnected,
        ExtraDescriptions = source.ExtraDescriptions,
        CurrentVersion = source.CurrentVersion
    };
}
