using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Config;
using client_win.Modules.Settings.Models;
using client_win.Modules.Updates;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Settings.ViewModels;

public sealed class OptionsViewModel : ObservableObject
{
    private OptionsState _state;
    private string _updateStatus = "Aucune vérification en cours.";
    private string _currentVersion;
    private bool _canCheckUpdates = true;
    private bool _canInstallUpdates;
    private readonly ClientConfiguration? _config;
    private readonly IDialogService? _dialogs;
    private ClientUpdateInfo? _lastUpdateInfo;

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
        _currentVersion = AppInfo.GetShortVersion();
        SaveCommand = new RelayCommand(onSave);
        CancelCommand = new RelayCommand(onCancel);
        CheckUpdateCommand = new AsyncRelayCommand(HandleCheckUpdateAsync, () => CanCheckUpdates);
        InstallUpdateCommand = new AsyncRelayCommand(HandleInstallUpdateAsync, () => CanInstallUpdates);
        _canInstallUpdates = false;
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
                OnPropertyChanged(nameof(IsChatMessagesVolumeEnabled));
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
    public bool IsChatMessagesVolumeEnabled => IsVolumeEnabled && SoundChatMessages;

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
        CanCheckUpdates = false;
        CanInstallUpdates = false;

        try
        {
            if (_config == null)
            {
                UpdateStatus = "Impossible de vérifier les mises à jour (configuration manquante).";
                return;
            }

            UpdateStatus = "Vérification des mises à jour...";
            var info = await ClientUpdateApi.GetAsync(_config).ConfigureAwait(true);
            _lastUpdateInfo = info;
            if (info == null)
            {
                UpdateStatus = "Impossible de contacter le serveur de mise à jour.";
                return;
            }

            CurrentVersion = AppInfo.GetShortVersion();

            if (info.UpdateRequired == true)
            {
                UpdateStatus = $"Mise à jour requise (min: {info.MinRequiredVersion ?? "inconnue"}).";
                CanInstallUpdates = true;
                return;
            }

            if (info.UpdateAvailable == true)
            {
                UpdateStatus = $"Mise à jour disponible (dernière: {info.LatestVersion ?? "inconnue"}).";
                CanInstallUpdates = true;
                return;
            }

            UpdateStatus = "Vous êtes à jour.";
        }
        catch (OperationCanceledException)
        {
            UpdateStatus = "Vérification annulée (timeout).";
        }
        catch (Exception ex)
        {
            UpdateStatus = $"Erreur lors de la vérification: {ex.Message}";
        }
        finally
        {
            CanCheckUpdates = true;
        }
    }

    private async Task HandleInstallUpdateAsync()
    {
        CanCheckUpdates = false;
        CanInstallUpdates = false;

        try
        {
            if (_dialogs == null)
            {
                UpdateStatus = "Impossible de lancer la mise à jour (dialogues indisponibles).";
                return;
            }

            var url = _lastUpdateInfo?.Url;
            UpdateStatus = "Installation de la mise à jour...";
            await ClientUpdateInstaller
                .InstallLatestAsync(_dialogs, url, reason: "options")
                .ConfigureAwait(true);

            // L'installation ClickOnce se termine au redémarrage, et le fallback lance l'installateur.
            // Dans tous les cas, on ferme l'app pour laisser Windows appliquer la mise à jour.
            Environment.Exit(0);
        }
        catch (OperationCanceledException)
        {
            UpdateStatus = "Installation annulée (timeout).";
        }
        catch (Exception ex)
        {
            UpdateStatus = $"Erreur lors de l'installation: {ex.Message}";
        }
        finally
        {
            CanCheckUpdates = true;
            CanInstallUpdates = false;
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
