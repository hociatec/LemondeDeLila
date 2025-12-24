using System;
using System.Collections.ObjectModel;
using System.Collections.Generic;
using System.Globalization;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Game.Models;
using client_win.Modules.Game.Services;
using client_win.Modules.Game.Sessions;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.ViewModels;

public sealed class RoomTableViewModel : ObservableObject
{
    private readonly RoomLaunchRequest _request;
    private readonly IRoomSessionFactory _sessionFactory;
    private readonly Action? _onClose;
    private readonly IDialogService _dialogs;
    private readonly Dispatcher _dispatcher;
    private RoomSession? _session;
    private readonly Action<string> _errorHandler;
    private readonly Action<string> _historyHandler;
    private bool _isSpectator;
    private RoomSnapshot _snapshot = new();

    private string _status = string.Empty;
    private string _roomName = string.Empty;
    private string _gameType = string.Empty;
    private string _privacyLabel = string.Empty;
    private string _roleLabel = string.Empty;
    private string _countsLabel = string.Empty;
    private bool _isBusy;
    private IReadOnlyList<int> _botIds = Array.Empty<int>();

    public RoomTableViewModel(RoomLaunchRequest request, IRoomSessionFactory sessionFactory, IDialogService dialogs, Action? onClose = null)
    {
        _request = request ?? throw new ArgumentNullException(nameof(request));
        _sessionFactory = sessionFactory ?? throw new ArgumentNullException(nameof(sessionFactory));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _onClose = onClose;
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        CloseCommand = new AsyncRelayCommand(RequestCloseAsync, () => !IsBusy);
        TogglePrivacyCommand = new AsyncRelayCommand(TogglePrivacyAsync, () => !IsBusy);
        ToggleRoleCommand = new AsyncRelayCommand(ToggleRoleAsync, () => !IsBusy);
        AddBotCommand = new AsyncRelayCommand(AddBotAsync, () => !IsBusy);
        RemoveBotCommand = new AsyncRelayCommand(RemoveBotAsync, () => !IsBusy);
        StartGameCommand = new AsyncRelayCommand(StartGameAsync, () => !IsBusy);
        ResetGameCommand = new AsyncRelayCommand(ResetGameAsync, () => !IsBusy);
        _errorHandler = message => RunOnUi(() => Status = message);
        _historyHandler = AddHistory;

        History = new ObservableCollection<string>();
        ApplySnapshot(new RoomSnapshot
        {
            RoomId = _request.RoomId,
            GameType = _request.GameType,
            RoomName = _request.RoomName,
            IsSpectator = _request.Spectator
        });
        Status = "Connexion a la table...";
    }

    public ICommand CloseCommand { get; }
    public ICommand TogglePrivacyCommand { get; }
    public ICommand ToggleRoleCommand { get; }
    public ICommand AddBotCommand { get; }
    public ICommand RemoveBotCommand { get; }
    public ICommand StartGameCommand { get; }
    public ICommand ResetGameCommand { get; }

    public ObservableCollection<string> History { get; }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public string RoomName
    {
        get => _roomName;
        set => SetProperty(ref _roomName, value);
    }

    public string GameType
    {
        get => _gameType;
        set => SetProperty(ref _gameType, value);
    }

    public string PrivacyLabel
    {
        get => _privacyLabel;
        set => SetProperty(ref _privacyLabel, value);
    }

    public string RoleLabel
    {
        get => _roleLabel;
        set => SetProperty(ref _roleLabel, value);
    }

    public string CountsLabel
    {
        get => _countsLabel;
        set => SetProperty(ref _countsLabel, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (SetProperty(ref _isBusy, value))
            {
                UpdateCommands();
            }
        }
    }

    public async Task InitializeAsync()
    {
        if (_session != null)
        {
            return;
        }
        IsBusy = true;
        _session = _sessionFactory.Create();
        _session.RoomUpdated += ApplySnapshot;
        _session.HistoryEvent += _historyHandler;
        _session.ErrorEvent += _errorHandler;
        try
        {
            await _session.ConnectAsync(_request.RoomId, _request.Spectator).ConfigureAwait(true);
            Status = "Table connectee.";
        }
        catch (Exception ex)
        {
            Status = $"Connexion impossible: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task ShutdownAsync()
    {
        if (_session == null)
        {
            return;
        }
        try
        {
            await _session.CloseAsync().ConfigureAwait(true);
        }
        finally
        {
            _session.RoomUpdated -= ApplySnapshot;
            _session.HistoryEvent -= _historyHandler;
            _session.ErrorEvent -= _errorHandler;
            await _session.DisposeAsync().ConfigureAwait(true);
            _session = null;
        }
    }

    private void ApplySnapshot(RoomSnapshot snapshot)
    {
        if (!CheckUiAccess())
        {
            _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => ApplySnapshot(snapshot)));
            return;
        }
        _snapshot = snapshot;
        RoomName = string.IsNullOrWhiteSpace(snapshot.RoomName) ? $"Table #{snapshot.RoomId}" : snapshot.RoomName;
        GameType = string.IsNullOrWhiteSpace(snapshot.GameType) ? _request.GameType : snapshot.GameType;
        PrivacyLabel = snapshot.IsPrivate ? "Privee" : "Publique";
        _isSpectator = snapshot.IsSpectator;
        RoleLabel = snapshot.IsSpectator ? "Spectateur" : "Joueur";
        CountsLabel = string.Format(
            CultureInfo.InvariantCulture,
            "Joueurs: {0}  Bots: {1}  Spectateurs: {2}",
            snapshot.PlayersCount,
            snapshot.BotsCount,
            snapshot.SpectatorsCount);
        _botIds = snapshot.BotIds;
    }

    public void AnnounceTableSummary()
    {
        string label = string.IsNullOrWhiteSpace(RoomName)
            ? (_snapshot.RoomId > 0 ? $"Table {_snapshot.RoomId}" : "Table")
            : RoomName.Trim();
        if (_snapshot.IsSpectator)
        {
            label = $"{label}. Spectateur";
        }

        int playerCount = _snapshot.PlayersCount > 0 ? _snapshot.PlayersCount : (_snapshot.PlayerNames?.Count ?? 0);
        int botCount = _snapshot.BotsCount > 0 ? _snapshot.BotsCount : (_snapshot.BotNames?.Count ?? 0);
        int spectatorCount = _snapshot.SpectatorsCount;
        string playerNames = JoinNames(_snapshot.PlayerNames, playerCount > 0 ? "inconnus" : "aucun");
        string botNames = JoinNames(_snapshot.BotNames, botCount > 0 ? "inconnus" : "aucun");

        AddHistory($"{label}. {playerCount} joueur{(playerCount > 1 ? "s" : "")} : {playerNames}. " +
                   $"{botCount} bot{(botCount > 1 ? "s" : "")} : {botNames}. " +
                   $"{spectatorCount} spectateur{(spectatorCount > 1 ? "s" : "")}.");
    }

    public void AnnounceTurnInfo()
    {
        AddHistory("Information de tour indisponible.");
    }

    private async Task RequestCloseAsync()
    {
        bool? confirmed = await _dialogs.Confirm("Quitter la table", "Etes-vous sur de quitter la table ?").ConfigureAwait(true);
        if (confirmed == true)
        {
            _onClose?.Invoke();
        }
    }

    private async Task TogglePrivacyAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        IsBusy = true;
        try
        {
            await _session.SendCommandAsync("room.toggle-privacy", new { }).ConfigureAwait(true);
            Status = "Demande de changement de confidentialite envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ToggleRoleAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        IsBusy = true;
        try
        {
            bool nextSpectator = !_isSpectator;
            await _session.SendCommandAsync("room.set-role", new { roomId = _request.RoomId, spectator = nextSpectator }).ConfigureAwait(true);
            Status = "Demande de changement de role envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task AddBotAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        if (_isSpectator)
        {
            Status = "Action interdite en mode spectateur.";
            return;
        }
        IsBusy = true;
        try
        {
            await _session.SendCommandAsync("bot.add", new { }).ConfigureAwait(true);
            Status = "Demande d'ajout de bot envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task RemoveBotAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        if (_isSpectator)
        {
            Status = "Action interdite en mode spectateur.";
            return;
        }
        if (_botIds == null || _botIds.Count == 0)
        {
            Status = "Aucun bot a retirer.";
            return;
        }
        int botId = _botIds[^1];
        IsBusy = true;
        try
        {
            await _session.SendCommandAsync("bot.remove", new { botId }).ConfigureAwait(true);
            Status = "Demande de retrait de bot envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task StartGameAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        if (_isSpectator)
        {
            Status = "Action interdite en mode spectateur.";
            return;
        }
        IsBusy = true;
        try
        {
            await _session.SendCommandAsync("room.start", new { }).ConfigureAwait(true);
            Status = "Demande de lancement envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ResetGameAsync()
    {
        if (_session == null)
        {
            Status = "Connexion indisponible.";
            return;
        }
        if (_isSpectator)
        {
            Status = "Action interdite en mode spectateur.";
            return;
        }
        IsBusy = true;
        try
        {
            await _session.SendCommandAsync("room.reset", new { }).ConfigureAwait(true);
            Status = "Demande de reinitialisation envoyee.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void AddHistory(string message)
    {
        if (!CheckUiAccess())
        {
            _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => AddHistory(message)));
            return;
        }
        if (string.IsNullOrWhiteSpace(message))
        {
            return;
        }
        string entry = $"[{DateTime.Now:HH:mm:ss}] {message}";
        History.Add(entry);
    }

    private bool CheckUiAccess() => _dispatcher.CheckAccess();

    private void RunOnUi(Action action)
    {
        if (CheckUiAccess())
        {
            action();
            return;
        }
        _dispatcher.BeginInvoke(DispatcherPriority.Background, action);
    }

    private static string JoinNames(IReadOnlyList<string>? names, string fallback)
    {
        if (names == null || names.Count == 0)
        {
            return fallback;
        }
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var list = new List<string>();
        foreach (var name in names)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }
            var trimmed = name.Trim();
            if (set.Add(trimmed))
            {
                list.Add(trimmed);
            }
        }
        return list.Count == 0 ? fallback : string.Join(", ", list);
    }

    private void UpdateCommands()
    {
        (CloseCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (TogglePrivacyCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (ToggleRoleCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (AddBotCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (RemoveBotCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (StartGameCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (ResetGameCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
    }
}
