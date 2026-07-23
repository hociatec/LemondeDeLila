using System;
using System.Linq;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Game.Common;
using client_win.Modules.Game.Room.Lobby.Services;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Room.Lobby.ViewModels;

public sealed class JoinGameViewModel : ObservableObject, IDisposable, IShellNavigationAware
{
    private readonly IRoomLobbyClient _rooms;
    private readonly IGameTableOpener _tables;
    private readonly IAnnouncementService _announcements;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly Func<object?> _returnContent;
    private IDisposable? _refreshSubscription;
    private IDisposable? _transportSubscription;
    private CancellationTokenSource? _refreshDebounceCts;
    private bool _isDisposed;
    private bool _subscribed;
    private bool _subscriptionSupported = true;
    private bool _initialized;
    private bool _isBusy;
    private string _status = "Chargement des tables...";
    private ObservableCollection<PublicRoomListItem> _roomsList = new();
    private PublicRoomListItem? _selected;
    private bool _lastEmptyAnnounced;

    public JoinGameViewModel(
        IRoomLobbyClient rooms,
        IGameTableOpener tables,
        IAnnouncementService announcements,
        Func<object?> returnContent,
        Action onClose)
    {
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _announcements = announcements ?? throw new ArgumentNullException(nameof(announcements));
        _returnContent = returnContent ?? throw new ArgumentNullException(nameof(returnContent));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        CloseCommand = new RelayCommand(_close);
        RefreshCommand = new AsyncRelayCommand(RefreshAsync);
        JoinSelectedCommand = new AsyncRelayCommand(JoinSelectedAsync);
    }

    public ObservableCollection<PublicRoomListItem> Rooms
    {
        get => _roomsList;
        private set => SetProperty(ref _roomsList, value);
    }

    public PublicRoomListItem? SelectedRoom
    {
        get => _selected;
        set => SetProperty(ref _selected, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set => SetProperty(ref _isBusy, value);
    }

    public ICommand CloseCommand { get; }
    public AsyncRelayCommand RefreshCommand { get; }
    public AsyncRelayCommand JoinSelectedCommand { get; }

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }

        _initialized = true;
        _transportSubscription = _rooms.OnTransportConnected(() =>
        {
            // Si le WS "api" est recréé, l'abonnement côté serveur est perdu (connectionId change).
            // On relance un refresh pour se ré-abonner sans forcer l'utilisateur à relancer le client.
            ScheduleRefresh();
        });

        await RefreshAsync().ConfigureAwait(true);
    }

    public async Task OnNavigatedToAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            return;
        }

        await InitializeAsync().ConfigureAwait(true);
    }

    public Task OnNavigatedFromAsync(ShellNavigationContext context, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    private async Task RefreshAsync()
    {
        if (IsBusy)
        {
            return;
        }

        IsBusy = true;
        try
        {
            Status = "Récupération des tables publiques...";

            PublicRoomsListedResult listed;
            if (_subscriptionSupported)
            {
                try
                {
                    listed = await _rooms.PublicSubscribeAsync().ConfigureAwait(true);
                    _subscribed = true;

                    _refreshSubscription ??= _rooms.OnPublicRefresh(() =>
                        // Reçu depuis un thread réseau; rebasculer sur UI.
                        ScheduleRefresh());
                }
                catch (Exception ex)
                {
                    // Compat: si le serveur n'est pas encore à jour, il répond "Type de message inconnu".
                    // On repasse en mode "liste uniquement" (rafraîchissement manuel).
                    var msg = (ex.Message ?? string.Empty).Trim();
                    if (msg.Contains("Type de message inconnu", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("message inconnu", StringComparison.OrdinalIgnoreCase))
                    {
                        _subscriptionSupported = false;
                        Status = "Serveur non à jour (room.lobby.subscribe indisponible). Rafraîchissement manuel.";
                    }
                    else
                    {
                        Status = $"Abonnement temps réel échoué : {msg}";
                    }

                    listed = await _rooms.PublicListAsync().ConfigureAwait(true);
                }
            }
            else
            {
                listed = await _rooms.PublicListAsync().ConfigureAwait(true);
            }

            var previousSelectedId = SelectedRoom?.Id ?? 0;
            Rooms.Clear();
            foreach (var item in listed.Items ?? Array.Empty<PublicRoomListItem>())
            {
                Rooms.Add(item);
            }

            if (Rooms.Count > 0)
            {
                _lastEmptyAnnounced = false;
                SelectedRoom = previousSelectedId > 0
                    ? Rooms.FirstOrDefault(r => r.Id == previousSelectedId) ?? Rooms[0]
                    : Rooms[0];
                if (_subscribed)
                {
                    Status = "Entrée : rejoindre la table sélectionnée. (Temps réel) Échap : retour.";
                }
                else
                {
                    Status = _subscriptionSupported
                        ? "Entrée : rejoindre la table sélectionnée. Échap : retour."
                        : "Entrée : rejoindre la table sélectionnée. (Rafraîchissement manuel) Échap : retour.";
                }
            }
            else
            {
                Status = "Aucune table publique active à rejoindre.";
                if (!_lastEmptyAnnounced)
                {
                    _lastEmptyAnnounced = true;
                    _announcements.Enqueue("Aucune table publique active à rejoindre.", AnnouncementPriority.Polite);
                }
            }
        }
        catch (Exception ex)
        {
            Status = $"Erreur : {ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task JoinSelectedAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var selected = SelectedRoom;
        if (selected == null || selected.Id <= 0)
        {
            Status = "Sélectionnez une table.";
            return;
        }

        IsBusy = true;
        try
        {
            var returnContent = _returnContent();
            if (returnContent == null)
            {
                return;
            }

            await _tables.OpenExistingAsync(selected.Id, returnContent, spectator: selected.SpectatorOnly).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }
        _isDisposed = true;

        try
        {
            _refreshDebounceCts?.Cancel();
            _refreshDebounceCts?.Dispose();
            _refreshSubscription?.Dispose();
            _transportSubscription?.Dispose();
        }
        catch
        {
            // ignore
        }
        _refreshSubscription = null;
        _transportSubscription = null;
        _refreshDebounceCts = null;

        if (_subscribed)
        {
            _subscribed = false;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(GameTiming.Table.RoomLobbyUnsubscribeTimeout);
                    await _rooms.PublicUnsubscribeAsync(cts.Token).ConfigureAwait(false);
                }
                catch
                {
                    // ignore
                }
            });
        }
    }

    private void ScheduleRefresh()
    {
        if (_isDisposed || !_subscriptionSupported)
        {
            return;
        }

        _refreshDebounceCts?.Cancel();
        _refreshDebounceCts?.Dispose();
        _refreshDebounceCts = new CancellationTokenSource();
        var token = _refreshDebounceCts.Token;

        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(GameTiming.Table.RoomLobbyRefreshDebounce, token).ConfigureAwait(false);
                if (token.IsCancellationRequested) return;

                await _dispatcher.BeginInvoke(
                    DispatcherPriority.Background,
                    new Action(() =>
                    {
                        if (!_isDisposed)
                        {
                            _ = RefreshCommand.ExecuteAsync(null);
                        }
                    }));
            }
            catch
            {
                // ignore
            }
        });
    }
}
