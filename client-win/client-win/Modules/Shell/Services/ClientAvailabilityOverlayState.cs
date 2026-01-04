using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Updates;

namespace client_win.Modules.Shell.Services;

public enum ClientAvailabilityOverlayKind
{
    Hidden,
    Reconnecting,
    Maintenance,
    UpdateInProgress,
    UpdateRequired
}

public sealed class ClientAvailabilityOverlayState : INotifyPropertyChanged
{
    private readonly Dispatcher _dispatcher;

    public ClientAvailabilityOverlayState(Dispatcher dispatcher)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        PrimaryActionCommand = new RelayCommand(() => _primaryAction?.Invoke(), () => HasPrimaryAction);
        SecondaryActionCommand = new RelayCommand(() => _secondaryAction?.Invoke(), () => HasSecondaryAction);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public ClientAvailabilityOverlayKind Kind
    {
        get => _kind;
        private set => Set(ref _kind, value);
    }
    private ClientAvailabilityOverlayKind _kind = ClientAvailabilityOverlayKind.Hidden;

    public bool IsVisible => Kind != ClientAvailabilityOverlayKind.Hidden;

    public bool IsBlocking
    {
        get => _isBlocking;
        private set => Set(ref _isBlocking, value);
    }
    private bool _isBlocking = true;

    public bool ShowProgress
    {
        get => _showProgress;
        private set => Set(ref _showProgress, value);
    }
    private bool _showProgress = true;

    public string Title
    {
        get => _title;
        private set => Set(ref _title, value);
    }
    private string _title = string.Empty;

    public string Message
    {
        get => _message;
        private set => Set(ref _message, value);
    }
    private string _message = string.Empty;

    public string Status
    {
        get => _status;
        private set => Set(ref _status, value);
    }
    private string _status = string.Empty;

    public string PrimaryActionText
    {
        get => _primaryActionText;
        private set => Set(ref _primaryActionText, value);
    }
    private string _primaryActionText = string.Empty;

    public bool HasPrimaryAction => !string.IsNullOrWhiteSpace(PrimaryActionText) && _primaryAction != null;

    public ICommand PrimaryActionCommand { get; }
    private Action? _primaryAction;

    public string SecondaryActionText
    {
        get => _secondaryActionText;
        private set => Set(ref _secondaryActionText, value);
    }
    private string _secondaryActionText = string.Empty;

    public bool HasSecondaryAction => !string.IsNullOrWhiteSpace(SecondaryActionText) && _secondaryAction != null;

    public ICommand SecondaryActionCommand { get; }
    private Action? _secondaryAction;

    public void Hide()
    {
        RunOnUi(() =>
        {
            Kind = ClientAvailabilityOverlayKind.Hidden;
            Title = string.Empty;
            Message = string.Empty;
            Status = string.Empty;
            ShowProgress = false;
            IsBlocking = false;
            SetPrimaryAction(null, null);
            SetSecondaryAction(null, null);
            Raise(nameof(IsVisible));
        });
    }

    public void ShowReconnecting(string reason, int attempt = 0, TimeSpan? nextDelay = null)
    {
        RunOnUi(() =>
        {
            Kind = ClientAvailabilityOverlayKind.Reconnecting;
            Title = "Connexion au serveur";
            Message = "Connexion perdue. Reconnexion en cours, veuillez patienter…";
            Status = BuildReconnectStatus(reason, attempt, nextDelay);
            ShowProgress = true;
            IsBlocking = true;
            SetPrimaryAction("Réessayer maintenant", () => RequestRetry?.Invoke());
            SetSecondaryAction("Fermer ce message", Hide);
            Raise(nameof(IsVisible));
        });
    }

    public void UpdateReconnectingAttempt(string reason, int attempt, TimeSpan? nextDelay)
    {
        RunOnUi(() =>
        {
            if (Kind != ClientAvailabilityOverlayKind.Reconnecting)
            {
                ShowReconnecting(reason, attempt, nextDelay);
                return;
            }

            Status = BuildReconnectStatus(reason, attempt, nextDelay);
        });
    }

    public void ShowMaintenance(string message)
    {
        RunOnUi(() =>
        {
            Kind = ClientAvailabilityOverlayKind.Maintenance;
            Title = "Redémarrage en cours";
            Message = string.IsNullOrWhiteSpace(message)
                ? "Le serveur redémarre. Veuillez patienter…"
                : message.Trim();
            Status = "Reconnexion automatique en cours.";
            ShowProgress = true;
            IsBlocking = true;
            SetPrimaryAction("Réessayer maintenant", () => RequestRetry?.Invoke());
            SetSecondaryAction(null, null);
            Raise(nameof(IsVisible));
        });
    }

    public void ShowUpdateInProgress(bool required, string message)
    {
        RunOnUi(() =>
        {
            Kind = required ? ClientAvailabilityOverlayKind.UpdateRequired : ClientAvailabilityOverlayKind.UpdateInProgress;
            Title = required ? "Mise à jour requise" : "Mise à jour";
            Message = string.IsNullOrWhiteSpace(message)
                ? "Une mise à jour est en cours. Veuillez patienter…"
                : message.Trim();
            Status = "Téléchargement / installation en cours.";
            ShowProgress = true;
            // Pas d'option "Plus tard": la mise à jour se fait automatiquement.
            IsBlocking = true;
            SetPrimaryAction("Redémarrer maintenant", () => UpdateRestartHelper.RestartCurrentProcess(reason: "update-ready"));
            SetSecondaryAction(null, null);
            Raise(nameof(IsVisible));
        });
    }

    public void ShowUpdateFailed(bool required, string message)
    {
        RunOnUi(() =>
        {
            Kind = required ? ClientAvailabilityOverlayKind.UpdateRequired : ClientAvailabilityOverlayKind.UpdateInProgress;
            Title = required ? "Mise à jour requise" : "Mise à jour";
            Message = string.IsNullOrWhiteSpace(message)
                ? "Impossible de lancer la mise à jour."
                : message.Trim();
            Status = required ? "Mise à jour nécessaire pour continuer." : "Vous pouvez continuer, mais la mise à jour n'a pas pu être lancée.";
            ShowProgress = false;
            IsBlocking = required;
            SetPrimaryAction(required ? "Réessayer" : null, () => UpdateRestartHelper.RestartCurrentProcess(reason: "update-retry"));
            SetSecondaryAction(required ? null : "Fermer", Hide);
            Raise(nameof(IsVisible));
        });
    }

    public event Action? RequestRetry;

    private void SetPrimaryAction(string? text, Action? action)
    {
        _primaryAction = action;
        PrimaryActionText = text ?? string.Empty;
        Raise(nameof(HasPrimaryAction));
        if (PrimaryActionCommand is RelayCommand cmd)
        {
            cmd.RaiseCanExecuteChanged();
        }
    }

    private void SetSecondaryAction(string? text, Action? action)
    {
        _secondaryAction = action;
        SecondaryActionText = text ?? string.Empty;
        Raise(nameof(HasSecondaryAction));
        if (SecondaryActionCommand is RelayCommand cmd)
        {
            cmd.RaiseCanExecuteChanged();
        }
    }

    private static string BuildReconnectStatus(string reason, int attempt, TimeSpan? nextDelay)
    {
        var r = (reason ?? string.Empty).Trim();
        if (r.Length == 0) r = "déconnecté";

        var a = attempt <= 0 ? string.Empty : $"Tentative {attempt}. ";
        var d = nextDelay.HasValue ? $"Prochaine tentative dans {Math.Max(0, (int)nextDelay.Value.TotalSeconds)}s." : string.Empty;
        return $"{a}{d} ({r})".Trim();
    }

    private void RunOnUi(Action action)
    {
        if (_dispatcher.CheckAccess())
        {
            action();
            return;
        }
        _dispatcher.BeginInvoke(action, DispatcherPriority.Normal);
    }

    private void Raise([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    private void Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
    {
        if (Equals(field, value)) return;
        field = value;
        Raise(name);
    }
}
