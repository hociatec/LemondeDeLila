using System;
using System.Collections.ObjectModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Game.RoomDirectory.Services;
using client_win.Modules.Game.Shell.Services;

namespace client_win.Modules.Game.RoomDirectory.ViewModels;

public sealed class JoinGameViewModel : ObservableObject, IDisposable
{
    private readonly IRoomDirectoryClient _rooms;
    private readonly IGameTableOpener _tables;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly UserControl _returnView;
    private IDisposable? _refreshSubscription;
    private bool _isDisposed;
    private bool _subscribed;
    private bool _subscriptionSupported = true;
    private bool _isBusy;
    private string _status = "Chargement des tables...";
    private PublicRoomListItem? _selected;

    public JoinGameViewModel(
        IRoomDirectoryClient rooms,
        IGameTableOpener tables,
        UserControl returnView,
        Action onClose)
    {
        _rooms = rooms ?? throw new ArgumentNullException(nameof(rooms));
        _tables = tables ?? throw new ArgumentNullException(nameof(tables));
        _returnView = returnView ?? throw new ArgumentNullException(nameof(returnView));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        CloseCommand = new RelayCommand(_close);
        RefreshCommand = new AsyncRelayCommand(RefreshAsync);
        JoinSelectedCommand = new AsyncRelayCommand(JoinSelectedAsync);

        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => RefreshCommand.Execute(null)));
    }

    public ObservableCollection<PublicRoomListItem> Rooms { get; } = new();

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
            if (!_subscribed && _subscriptionSupported)
            {
                try
                {
                    listed = await _rooms.PublicSubscribeAsync().ConfigureAwait(true);
                    _subscribed = true;

                    _refreshSubscription = _rooms.OnPublicRefresh(() =>
                    {
                        // Reçu depuis un thread réseau; rebasculer sur UI.
                        _ = _dispatcher.BeginInvoke(
                            DispatcherPriority.Background,
                            new Action(() => _ = RefreshCommand.ExecuteAsync(null)));
                    });
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
                        Status = "Serveur non à jour (rooms.public.subscribe indisponible). Rafraîchissement manuel.";
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

            Rooms.Clear();
            foreach (var item in listed.Items)
            {
                Rooms.Add(item);
            }

            if (Rooms.Count > 0)
            {
                SelectedRoom ??= Rooms[0];
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
                Status = "Aucune table à rejoindre.";
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
            await _tables.OpenExistingAsync(selected.Id, _returnView).ConfigureAwait(true);
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
            _refreshSubscription?.Dispose();
        }
        catch
        {
            // ignore
        }
        _refreshSubscription = null;

        if (_subscribed)
        {
            _subscribed = false;
            _ = Task.Run(async () =>
            {
                try
                {
                    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    await _rooms.PublicUnsubscribeAsync(cts.Token).ConfigureAwait(false);
                }
                catch
                {
                    // ignore
                }
            });
        }
    }
}
