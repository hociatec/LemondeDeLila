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
    private readonly IRoomTableNavigator _navigator;
    private readonly Action? _onClose;
    private string _status = "Chargement...";
    private PublicRoomSummary? _selectedRoom;
    private bool _isBusy;

    public JoinGameViewModel(IRoomDirectoryService directory, IRoomTableNavigator navigator, Action? onClose = null)
    {
        _directory = directory ?? throw new ArgumentNullException(nameof(directory));
        _navigator = navigator ?? throw new ArgumentNullException(nameof(navigator));
        _onClose = onClose;
        CloseCommand = new RelayCommand(HandleClose);
        RefreshCommand = new AsyncRelayCommand(RefreshRoomsAsync, () => !IsBusy);
        JoinCommand = new AsyncRelayCommand(JoinSelectedRoomAsync, () => SelectedRoom != null && !IsBusy);
        SpectateCommand = new AsyncRelayCommand(SpectateSelectedRoomAsync, () => SelectedRoom != null && !IsBusy);

        Rooms = new ObservableCollection<PublicRoomSummary>();
        _ = RefreshRoomsAsync();
    }

    public ICommand CloseCommand { get; }
    public ICommand RefreshCommand { get; }
    public ICommand JoinCommand { get; }
    public ICommand SpectateCommand { get; }

    public ObservableCollection<PublicRoomSummary> Rooms { get; }

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
            Status = "Chargement...";
            var rooms = await _directory.ListPublicRoomsAsync(null).ConfigureAwait(true);
            Rooms.Clear();
            SelectedRoom = null;
            foreach (var room in rooms)
            {
                Rooms.Add(room);
            }
            if (Rooms.Count > 0)
            {
                SelectedRoom ??= Rooms[0];
            }
            Status = Rooms.Count == 0
                ? "Aucune table publique en cours."
                : "Tables publiques chargées.";
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

    private async Task SpectateSelectedRoomAsync()
    {
        if (SelectedRoom == null)
        {
            Status = "Aucune table sélectionnée.";
            return;
        }

        IsBusy = true;
        try
        {
            Status = $"Ouverture en spectateur de {SelectedRoom.Name}...";
            var joined = await _directory.SpectatePublicRoomAsync(SelectedRoom.Id).ConfigureAwait(true);
            if (joined == null)
            {
                Status = "Ouverture impossible.";
                return;
            }
            Status = $"Table ouverte en spectateur: #{joined.RoomId} ({joined.GameType}).";
            _navigator.OpenRoom(new RoomLaunchRequest(joined.RoomId, joined.GameType, joined.RoomName, spectator: true));
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

    private void UpdateCommands()
    {
        (RefreshCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (JoinCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
        (SpectateCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
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
