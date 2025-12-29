using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Settings.Models;
using client_win.Modules.Updates;

namespace client_win.Modules.Settings.ViewModels;

public sealed class OptionsViewModel : ObservableObject
{
    private OptionsState _state;
    private string _updateStatus = "Aucune vérification en cours.";
    private string _currentVersion;
    private bool _updateAvailable;
    private bool _canCheckUpdates = true;
    private bool _canInstallUpdates;
    private readonly IUpdateService _updates;

    public OptionsViewModel(OptionsState state, IUpdateService updates, Action onSave, Action onCancel)
    {
        _state = state ?? throw new ArgumentNullException(nameof(state));
        _updates = updates ?? throw new ArgumentNullException(nameof(updates));
        _currentVersion = string.IsNullOrWhiteSpace(_updates.CurrentVersion) ? "inconnue" : _updates.CurrentVersion;
        SaveCommand = new RelayCommand(onSave);
        CancelCommand = new RelayCommand(onCancel);
        CheckUpdateCommand = new AsyncRelayCommand(HandleCheckUpdateAsync, () => CanCheckUpdates);
        InstallUpdateCommand = new AsyncRelayCommand(HandleInstallUpdateAsync, () => CanInstallUpdates);

        if (!_updates.IsSupported)
        {
            _updateStatus = "Mises à jour indisponibles (installation ClickOnce requise).";
            _canInstallUpdates = false;
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
                OnPropertyChanged(nameof(IsAppLaunchVolumeEnabled));
                OnPropertyChanged(nameof(IsBackgroundVolumeEnabled));
                OnPropertyChanged(nameof(IsNavigateVolumeEnabled));
                OnPropertyChanged(nameof(IsSelectVolumeEnabled));
            }
        }
    }

    public bool ConfirmExit
    {
        get => _state.ConfirmExit;
        set => Update(() => _state.ConfirmExit, v => _state.ConfirmExit = v, value);
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

    public bool SoundBackground
    {
        get => _state.SoundBackground;
        set
        {
            if (Update(() => _state.SoundBackground, v => _state.SoundBackground = v, value))
            {
                OnPropertyChanged(nameof(IsBackgroundVolumeEnabled));
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

    public int MusicVolume
    {
        get => _state.MusicVolume;
        set => Update(() => _state.MusicVolume, v => _state.MusicVolume = v, value);
    }

    public int SoundAppLaunchVolume
    {
        get => _state.SoundAppLaunchVolume;
        set => Update(() => _state.SoundAppLaunchVolume, v => _state.SoundAppLaunchVolume = v, value);
    }

    public int SoundBackgroundVolume
    {
        get => _state.SoundBackgroundVolume;
        set => Update(() => _state.SoundBackgroundVolume, v => _state.SoundBackgroundVolume = v, value);
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

    public bool StayConnected
    {
        get => _state.StayConnected;
        set => Update(() => _state.StayConnected, v => _state.StayConnected = v, value);
    }

    public bool ExtraDescriptions
    {
        get => _state.ExtraDescriptions;
        set => Update(() => _state.ExtraDescriptions, v => _state.ExtraDescriptions = v, value);
    }

    public string CurrentVersion
    {
        get => _currentVersion;
        set => SetProperty(ref _currentVersion, value);
    }

    public string UpdateStatus
    {
        get => _updateStatus;
        set => SetProperty(ref _updateStatus, value);
    }

    public bool CanCheckUpdates
    {
        get => _canCheckUpdates;
        private set
        {
            if (SetProperty(ref _canCheckUpdates, value))
            {
                (CheckUpdateCommand as RelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public bool CanInstallUpdates
    {
        get => _canInstallUpdates;
        private set
        {
            if (SetProperty(ref _canInstallUpdates, value))
            {
                (InstallUpdateCommand as RelayCommand)?.RaiseCanExecuteChanged();
            }
        }
    }

    public bool IsVolumeEnabled => !MuteAll;
    public bool IsAppLaunchVolumeEnabled => IsVolumeEnabled && SoundAppLaunch;
    public bool IsBackgroundVolumeEnabled => IsVolumeEnabled && SoundBackground;
    public bool IsNavigateVolumeEnabled => IsVolumeEnabled && SoundNavigate;
    public bool IsSelectVolumeEnabled => IsVolumeEnabled && SoundSelect;

    public ICommand SaveCommand { get; }
    public ICommand CancelCommand { get; }
    public ICommand CheckUpdateCommand { get; }
    public ICommand InstallUpdateCommand { get; }

    public OptionsState ToState()
    {
        _state.CurrentVersion = _currentVersion;
        return _state;
    }

    private async Task HandleCheckUpdateAsync()
    {
        if (!_updates.IsSupported)
        {
            UpdateStatus = "Mises à jour indisponibles (installation ClickOnce requise).";
            CanInstallUpdates = false;
            return;
        }

        CanCheckUpdates = false;
        CanInstallUpdates = false;
        _updateAvailable = false;
        UpdateStatus = "Recherche de mise à jour...";

        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var result = await _updates.CheckAsync(cts.Token).ConfigureAwait(true);
            UpdateStatus = result.StatusMessage;
            _updateAvailable = result.IsUpdateAvailable;
        }
        catch (OperationCanceledException)
        {
            UpdateStatus = "Vérification annulée (timeout).";
        }
        finally
        {
            CanCheckUpdates = true;
            CanInstallUpdates = _updateAvailable;
        }
    }

    private async Task HandleInstallUpdateAsync()
    {
        if (!_updateAvailable)
        {
            UpdateStatus = "Aucune mise à jour disponible.";
            CanInstallUpdates = false;
            return;
        }

        if (!_updates.IsSupported)
        {
            UpdateStatus = "Installation impossible (installation ClickOnce requise).";
            CanInstallUpdates = false;
            return;
        }

        CanCheckUpdates = false;
        CanInstallUpdates = false;
        UpdateStatus = "Téléchargement et installation en cours...";
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            var result = await _updates.InstallAsync(cts.Token).ConfigureAwait(true);
            UpdateStatus = result.StatusMessage;
            if (result.RestartRequired && result.Installed)
            {
                UpdateRestartHelper.RestartCurrentProcess();
            }
        }
        catch (OperationCanceledException)
        {
            UpdateStatus = "Installation annulée (timeout).";
        }
        finally
        {
            CanCheckUpdates = true;
            CanInstallUpdates = false;
            _updateAvailable = false;
        }
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
