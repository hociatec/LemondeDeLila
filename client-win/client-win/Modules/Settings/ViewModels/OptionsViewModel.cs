using System;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Config;
using client_win.Modules.Settings.Models;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.ViewModels;

public sealed class OptionsViewModel : ObservableObject
{
    private OptionsState _state;
    private readonly ClientConfiguration? _config;
    private readonly IDialogService? _dialogs;
    private string _selectedCategory = "Général";

    public OptionsViewModel(
        OptionsState state,
        ClientConfiguration? config,
        IDialogService? dialogs,
        Action onSave,
        Action onCancel)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));
        _config = config;
        _dialogs = dialogs;
        SaveCommand = new RelayCommand(onSave);
        CancelCommand = new RelayCommand(onCancel);
    }

    public string[] Categories { get; } = ["Général", "Sons", "Tchat"];

    public string SelectedCategory
    {
        get => _selectedCategory;
        set
        {
            if (_selectedCategory == value)
            {
                return;
            }
            _selectedCategory = value;
            OnPropertyChanged();
        }
    }

    public bool MuteAll
    {
        get => _state.MuteAll;
        set
        {
            if (Update(() => _state.MuteAll, v => _state.MuteAll = v, value))
            {
                OnPropertyChanged(nameof(IsVolumeEnabled));
                OnPropertyChanged(nameof(IsAmbienceVolumeEnabled));
                OnPropertyChanged(nameof(IsAppLaunchVolumeEnabled));
                OnPropertyChanged(nameof(IsNavigateVolumeEnabled));
                OnPropertyChanged(nameof(IsSelectVolumeEnabled));
                OnPropertyChanged(nameof(IsChatMessagesVolumeEnabled));
            }
        }
    }

    public bool ConfirmExit
    {
        get => _state.ConfirmExit;
        set => Update(() => _state.ConfirmExit, v => _state.ConfirmExit = v, value);
    }

    public bool SoundAmbience
    {
        get => _state.SoundAmbience;
        set
        {
            if (Update(() => _state.SoundAmbience, v => _state.SoundAmbience = v, value))
            {
                OnPropertyChanged(nameof(IsAmbienceVolumeEnabled));
            }
        }
    }

    public bool SoundAppLaunch
    {
        get => _state.SoundAppLaunch;
        set
        {
            if (Update(() => _state.SoundAppLaunch, v => _state.SoundAppLaunch = v, value))
            {
                OnPropertyChanged(nameof(IsAppLaunchVolumeEnabled));
            }
        }
    }

    public bool SoundNavigate
    {
        get => _state.SoundNavigate;
        set
        {
            if (Update(() => _state.SoundNavigate, v => _state.SoundNavigate = v, value))
            {
                OnPropertyChanged(nameof(IsNavigateVolumeEnabled));
            }
        }
    }

    public bool SoundSelect
    {
        get => _state.SoundSelect;
        set
        {
            if (Update(() => _state.SoundSelect, v => _state.SoundSelect = v, value))
            {
                OnPropertyChanged(nameof(IsSelectVolumeEnabled));
            }
        }
    }

    public bool SoundChatMessages
    {
        get => _state.SoundChatMessages;
        set
        {
            if (Update(() => _state.SoundChatMessages, v => _state.SoundChatMessages = v, value))
            {
                OnPropertyChanged(nameof(IsChatMessagesVolumeEnabled));
            }
        }
    }

    public int SoundAppLaunchVolume
    {
        get => _state.SoundAppLaunchVolume;
        set => Update(() => _state.SoundAppLaunchVolume, v => _state.SoundAppLaunchVolume = v, value);
    }

    public int SoundAmbienceVolume
    {
        get => _state.SoundAmbienceVolume;
        set => Update(() => _state.SoundAmbienceVolume, v => _state.SoundAmbienceVolume = v, value);
    }

    public int SoundMenuAmbienceVolume
    {
        get => _state.SoundMenuAmbienceVolume;
        set
        {
            if (Update(() => _state.SoundMenuAmbienceVolume, v => _state.SoundMenuAmbienceVolume = v, value))
            {
                _state.SoundAmbienceSplit = true;
            }
        }
    }

    public int SoundTavernAmbienceVolume
    {
        get => _state.SoundTavernAmbienceVolume;
        set
        {
            if (Update(() => _state.SoundTavernAmbienceVolume, v => _state.SoundTavernAmbienceVolume = v, value))
            {
                _state.SoundAmbienceSplit = true;
            }
        }
    }

    public int SoundNavigateVolume
    {
        get => _state.SoundNavigateVolume;
        set => Update(() => _state.SoundNavigateVolume, v => _state.SoundNavigateVolume = v, value);
    }

    public int SoundSelectVolume
    {
        get => _state.SoundSelectVolume;
        set => Update(() => _state.SoundSelectVolume, v => _state.SoundSelectVolume = v, value);
    }

    public int SoundChatMessagesVolume
    {
        get => _state.SoundChatMessagesVolume;
        set => Update(() => _state.SoundChatMessagesVolume, v => _state.SoundChatMessagesVolume = v, value);
    }

    public bool ChatEnabled
    {
        get => _state.ChatEnabled;
        set => Update(() => _state.ChatEnabled, v => _state.ChatEnabled = v, value);
    }

    public bool ConfirmChatExit
    {
        get => _state.ConfirmChatExit;
        set => Update(() => _state.ConfirmChatExit, v => _state.ConfirmChatExit = v, value);
    }

    public bool IsVolumeEnabled => !MuteAll;
    public bool IsAmbienceVolumeEnabled => IsVolumeEnabled && SoundAmbience;
    public bool IsMenuAmbienceVolumeEnabled => IsAmbienceVolumeEnabled;
    public bool IsTavernAmbienceVolumeEnabled => IsAmbienceVolumeEnabled;
    public bool IsAppLaunchVolumeEnabled => IsVolumeEnabled && SoundAppLaunch;
    public bool IsNavigateVolumeEnabled => IsVolumeEnabled && SoundNavigate;
    public bool IsSelectVolumeEnabled => IsVolumeEnabled && SoundSelect;
    public bool IsChatMessagesVolumeEnabled => IsVolumeEnabled && SoundChatMessages;

    public ICommand SaveCommand { get; }
    public ICommand CancelCommand { get; }

    public OptionsState ToState()
    {
        _state.CurrentVersion = AppInfo.GetShortVersion();
        return _state;
    }

    private bool Update<T>(Func<T> getter, Action<T> setter, T value)
    {
        var current = getter();
        if (Equals(current, value))
        {
            return false;
        }
        setter(value);
        OnPropertyChanged();
        return true;
    }

}
