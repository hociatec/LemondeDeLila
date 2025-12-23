using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Settings.Models;
using client_win.Modules.Settings.ViewModels;
using client_win.Modules.Settings.Views;

namespace client_win.Modules.Settings.Services;

public sealed class OptionsService : IOptionsService
{
    private OptionsState _state = new();

    public OptionsState Current => _state;

    public void Update(OptionsState state)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));
    }

    public Task<string> OpenAsync()
    {
        var tcs = new TaskCompletionSource<string>();
        Application.Current?.Dispatcher.InvokeAsync(() =>
        {
            OptionsViewModel? vm = null;
            var dialog = new OptionsDialog();
            vm = new OptionsViewModel(CloneState(_state),
                onSave: () =>
                {
                    if (vm != null)
                    {
                        _state = vm.ToState();
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
        });
        return tcs.Task;
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
