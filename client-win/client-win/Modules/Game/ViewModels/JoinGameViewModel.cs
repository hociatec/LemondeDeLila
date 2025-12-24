using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Game.Models;
using client_win.Modules.Game.Services;

namespace client_win.Modules.Game.ViewModels;

/// <summary>
/// ViewModel pour la sélection et l'accès aux parties de jeu.
/// </summary>
public sealed class JoinGameViewModel : ObservableObject
{
    private readonly IRoomDirectoryService _directory;
    private readonly IRoomRealtimeService _realtime;
    private readonly IRoomTableNavigator _navigator;
    private readonly Action? _onClose;
    private string _status = "Chargement des parties disponibles...";
    private string _gameTypeFilter = string.Empty;
    private string _newGameType = string.Empty;
    private string _newRoomName = string.Empty;
    private int _newMaxPlayers = 4;
    private bool _newIsPrivate;
    private PublicRoomSummary? _selectedRoom;
    private bool _isBusy;

    public JoinGameViewModel(IRoomDirectoryService directory, IRoomRealtimeService realtime, IRoomTableNavigator navigator, Action? onClose = null)
    {
        _directory = directory ?? throw new ArgumentNullException(nameof(directory));
        _realtime = realtime ?? throw new ArgumentNullException(nameof(realtime));
        _navigator = navigator ?? throw new ArgumentNullException(nameof(navigator));
        _onClose = onClose;
        CloseCommand = new RelayCommand(HandleClose);
        RefreshCommand = new AsyncRelayCommand(RefreshRoomsAsync, () => !IsBusy);
        JoinCommand = new AsyncRelayCommand(JoinSelectedRoomAsync, () => SelectedRoom != null && !IsBusy);
        CreateCommand = new AsyncRelayCommand(CreateRoomAsync, CanCreateRoom);

        Rooms = new ObservableCollection<PublicRoomSummary>();
        _ = RefreshRoomsAsync();
    }

    public ICommand CloseCommand { get; }
    public ICommand RefreshCommand { get; }
    public ICommand JoinCommand { get; }
    public ICommand CreateCommand { get; }

    public ObservableCollection<PublicRoomSummary> Rooms { get; }

    public string GameTypeFilter
    {
        get => _gameTypeFilter;
        set
        {
            if (SetProperty(ref _gameTypeFilter, value))
            {
                UpdateCommands();
            }
        }
    }

    public PublicRoomSummary? SelectedRoom
    {
        get => _selectedRoom;
        set
        {
            if (SetProperty(ref _selectedRoom, value))
            {
                UpdateCommands();
            }
        }
    }

    public string NewGameType
    {
        get => _newGameType;
        set
        {
            if (SetProperty(ref _newGameType, value))
            {
                UpdateCommands();
            }
        }
    }

    public string NewRoomName
    {
        get => _newRoomName;
        set => SetProperty(ref _newRoomName, value);
    }

    public int NewMaxPlayers
    {
        get => _newMaxPlayers;
        set => SetProperty(ref _newMaxPlayers, value);
    }

    public bool NewIsPrivate
    {
        get => _newIsPrivate;
        set => SetProperty(ref _newIsPrivate, value);
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

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    private async Task RefreshRoomsAsync()
    {
        IsBusy = true;
        try
        {
            Status = "Chargement des tables publiques...";
            var rooms = await _directory.ListPublicRoomsAsync(GameTypeFilter).ConfigureAwait(true);
            Rooms.Clear();
            foreach (var room in rooms)
            {
                Rooms.Add(room);
            }
            Status = Rooms.Count == 0
                ? "Aucune table publique disponible."
                : $"Tables publiques disponibles: {Rooms.Count}.";
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {Clean(ex.Message)}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task JoinSelectedRoomAsync()
    {
        if (SelectedRoom == null)
        {
            Status = "Aucune table sélectionnée.";
            return;
        }

        IsBusy = true;
        try
        {
            Status = $"Connexion a la table {SelectedRoom.Name}...";
            var joined = await _directory.JoinPublicRoomAsync(SelectedRoom.Id).ConfigureAwait(true);
            if (joined == null)
            {
                Status = "Connexion impossible.";
                return;
            }
            Status = $"Table rejointe: #{joined.RoomId} ({joined.GameType}).";
            _navigator.OpenRoom(new RoomLaunchRequest(joined.RoomId, joined.GameType, joined.RoomName, spectator: false));
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {Clean(ex.Message)}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task CreateRoomAsync()
    {
        string gameType = NewGameType?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(gameType))
        {
            Status = "Code de jeu requis.";
            return;
        }

        int maxPlayers = NewMaxPlayers < 1 ? 1 : NewMaxPlayers;
        IsBusy = true;
        try
        {
            Status = "Creation de la table...";
            var created = await _realtime.CreateRoomAsync(
                new CreateRoomRequest(gameType, NewRoomName, maxPlayers, NewIsPrivate)).ConfigureAwait(true);

            if (created == null)
            {
                Status = "Creation impossible.";
                return;
            }

            Status = $"Table creee: #{created.RoomId} ({created.GameType}).";
            _navigator.OpenRoom(new RoomLaunchRequest(created.RoomId, created.GameType, created.RoomName, spectator: false));
            if (!NewIsPrivate)
            {
                await RefreshRoomsAsync().ConfigureAwait(true);
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur: {Clean(ex.Message)}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private bool CanCreateRoom()
    {
        return !IsBusy && !string.IsNullOrWhiteSpace(NewGameType);
    }

    private void UpdateCommands()
    {
        (RefreshCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (JoinCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (CreateCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
    }

    private void HandleClose()
    {
        _onClose?.Invoke();
    }

    private static string Clean(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return "Erreur inconnue";
        }
        return string.Join(' ', message.Split(default(string[]), StringSplitOptions.RemoveEmptyEntries));
    }
}
