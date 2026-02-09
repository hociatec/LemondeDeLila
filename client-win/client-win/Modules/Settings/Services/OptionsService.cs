using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using client_win.Core.Settings;
using client_win.Modules.Config;
using client_win.Modules.Settings.Models;
using client_win.Modules.Settings.ViewModels;
using client_win.Modules.Settings.Views;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.Services;

public sealed class OptionsService : IOptionsService
{
    private readonly SettingsManager<OptionsState>? _settingsManager;
    private readonly INavigationService? _navigation;
    private readonly ClientConfiguration? _config;
    private readonly IDialogService? _dialogs;
    private OptionsState _state;

    public OptionsService()
    {
        _state = new OptionsState();
    }

    public OptionsService(SettingsManager<OptionsState> settingsManager)
    {
        _settingsManager = settingsManager ?? throw new ArgumentNullException(nameof(settingsManager));
        _state = _settingsManager.Current;
        UpgradeStateIfNeeded();
    }

    public OptionsService(SettingsManager<OptionsState> settingsManager, INavigationService navigation)
    {
        _settingsManager = settingsManager ?? throw new ArgumentNullException(nameof(settingsManager));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _state = _settingsManager.Current;
        UpgradeStateIfNeeded();
    }

    public OptionsService(
        SettingsManager<OptionsState> settingsManager,
        INavigationService navigation,
        ClientConfiguration config,
        IDialogService dialogs)
    {
        _settingsManager = settingsManager ?? throw new ArgumentNullException(nameof(settingsManager));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _state = _settingsManager.Current;
        UpgradeStateIfNeeded();
    }

    public OptionsState Current => _state;

    public event EventHandler? Changed;

    public void Update(OptionsState state)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));

        if (_settingsManager != null)
        {
            _settingsManager.UpdateAndSave(state);
        }

        Changed?.Invoke(this, EventArgs.Empty);
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

            var previous = _navigation.CurrentContent;
            OptionsViewModel? vm = null;

            var clone = CloneState(_state);
            vm = new OptionsViewModel(
                clone,
                _config,
                _dialogs,
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

            EventHandler<object?>? handler = null;
            handler = (_, content) =>
            {
                if (handler != null && !ReferenceEquals(content, vm))
                {
                    _navigation.CurrentContentChanged -= handler;
                    if (!tcs.Task.IsCompleted)
                    {
                        tcs.TrySetResult("Options fermées.");
                    }
                }
            };
            _navigation.CurrentContentChanged += handler;
            _navigation.Show(vm);
        });

        return tcs.Task;
    }

    private void OpenLegacyDialog(TaskCompletionSource<string> tcs)
    {
        OptionsViewModel? vm = null;
        var dialog = new OptionsDialog();
        var clone = CloneState(_state);
        vm = new OptionsViewModel(
            clone,
            _config,
            _dialogs,
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
        EnableBetaGames = source.EnableBetaGames,
        SoundAmbience = source.SoundAmbience,
        SoundAppLaunch = source.SoundAppLaunch,
        SoundAmbienceVolume = source.SoundAmbienceVolume,
        SoundAmbienceSplit = source.SoundAmbienceSplit,
        SoundMenuAmbienceVolume = source.SoundMenuAmbienceVolume,
        SoundTavernAmbienceVolume = source.SoundTavernAmbienceVolume,
        SoundAppLaunchVolume = source.SoundAppLaunchVolume,
        SoundNavigate = source.SoundNavigate,
        SoundNavigateVolume = source.SoundNavigateVolume,
        SoundSelect = source.SoundSelect,
        SoundSelectVolume = source.SoundSelectVolume,
        SoundChatMessages = source.SoundChatMessages,
        SoundChatMessagesVolume = source.SoundChatMessagesVolume,
        SoundTableAmbience = source.SoundTableAmbience,
        SoundTableAmbienceVolume = source.SoundTableAmbienceVolume,
        TableAmbiencePrefsByVaultSnapshotId = source.TableAmbiencePrefsByVaultSnapshotId == null
            ? new()
            : source.TableAmbiencePrefsByVaultSnapshotId.ToDictionary(
                kv => kv.Key,
                kv => kv.Value == null
                    ? new OptionsState.TableAmbienceSnapshotPrefs()
                    : new OptionsState.TableAmbienceSnapshotPrefs
                    {
                        Enabled = kv.Value.Enabled,
                        Volume = kv.Value.Volume
                    }),
        SoundRoomOpenedPath = source.SoundRoomOpenedPath,
        SoundRoomJoinedPath = source.SoundRoomJoinedPath,
        SoundRoomExitPath = source.SoundRoomExitPath,
        SoundInvitationSentPath = source.SoundInvitationSentPath,
        SoundInvitationReceivedPath = source.SoundInvitationReceivedPath,
        SoundFriendConnectedPath = source.SoundFriendConnectedPath,
        SoundFriendDisconnectedPath = source.SoundFriendDisconnectedPath,
        SoundFriendInvitationSentPath = source.SoundFriendInvitationSentPath,
        SoundFriendInvitationReceivedPath = source.SoundFriendInvitationReceivedPath,
        SoundGameVictoryPath = source.SoundGameVictoryPath,
        SoundGameDefeatPath = source.SoundGameDefeatPath,
        SoundChatMessageSentPath = source.SoundChatMessageSentPath,
        SoundChatMessageReceivedPath = source.SoundChatMessageReceivedPath,
        SoundPrivateMessageSentPath = source.SoundPrivateMessageSentPath,
        SoundPrivateMessageReceivedPath = source.SoundPrivateMessageReceivedPath,
        SoundClientOpenedPath = source.SoundClientOpenedPath,
        SoundClientConnectedPath = source.SoundClientConnectedPath,
        SoundClientDisconnectedPath = source.SoundClientDisconnectedPath,
        SoundClientClosingPath = source.SoundClientClosingPath,
        SoundPawnPickedPath = source.SoundPawnPickedPath,
        SoundPawnPlacedSelfPath = source.SoundPawnPlacedSelfPath,
        SoundPawnPlacedOpponentPath = source.SoundPawnPlacedOpponentPath,
        SoundWallPlacedSelfPath = source.SoundWallPlacedSelfPath,
        SoundWallPlacedOpponentPath = source.SoundWallPlacedOpponentPath,
        ChatEnabled = source.ChatEnabled,
        ConfirmChatExit = source.ConfirmChatExit,
        AdminChatModerationLoadLimit = source.AdminChatModerationLoadLimit,
        CurrentVersion = source.CurrentVersion
    };

    private void UpgradeStateIfNeeded()
    {
        if (_settingsManager == null)
        {
            return;
        }

        // Migration: older settings.json had only SoundAmbienceVolume (menu + tavern).
        // If split volumes look untouched, propagate the legacy value once.
        if (_state.SoundAmbienceSplit)
        {
            return;
        }

        var legacy = _state.SoundAmbienceVolume;
        var looksLikeLegacyOnly = _state.SoundMenuAmbienceVolume == 25 &&
                                  _state.SoundTavernAmbienceVolume == 25 &&
                                  legacy != 25;
        if (!looksLikeLegacyOnly)
        {
            return;
        }

        _state.SoundMenuAmbienceVolume = legacy;
        _state.SoundTavernAmbienceVolume = legacy;
        _state.SoundAmbienceSplit = true;
        _settingsManager.UpdateAndSave(_state);
    }
}
