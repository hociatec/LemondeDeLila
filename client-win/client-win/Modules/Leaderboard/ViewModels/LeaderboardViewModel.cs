using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Leaderboard.Dtos;
using client_win.Modules.Leaderboard.Services;

namespace client_win.Modules.Leaderboard.ViewModels;

public enum LeaderboardNavResult
{
    Stay,
    Moved,
    Closed
}

public sealed class LeaderboardViewModel : ObservableObject
{
    private readonly ILeaderboardService _service;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private LeaderboardPage _page = LeaderboardPage.Games;
    private string _title = "Classement";
    private string _status = string.Empty;
    private bool _isBusy;
    private LeaderboardGameDto? _selectedGame;
    private const string EmptyInfo = "Aucune information encore disponible";

    public LeaderboardViewModel(ILeaderboardService service, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;

        Items = new ObservableCollection<LeaderboardMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        Status = "Chargement...";
        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () => await LoadGamesAsync().ConfigureAwait(true)));
    }

    public ObservableCollection<LeaderboardMenuItem> Items { get; }

    public LeaderboardMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }
    private LeaderboardMenuItem? _selectedItem;

    public string Title
    {
        get => _title;
        private set => SetProperty(ref _title, value);
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

    public AsyncRelayCommand ActivateCommand { get; }

    public LeaderboardNavResult HandleEscape()
    {
        if (_page == LeaderboardPage.Top)
        {
            _page = LeaderboardPage.Games;
            _selectedGame = null;
            Title = "Classement";
            Status = "Choisissez un jeu. Échap : retour.";
            _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(async () => await LoadGamesAsync().ConfigureAwait(true)));
            return LeaderboardNavResult.Moved;
        }

        _close();
        return LeaderboardNavResult.Closed;
    }

    private async Task LoadGamesAsync()
    {
        if (IsBusy) return;
        IsBusy = true;
        try
        {
            var games = await _service.GetGamesAsync().ConfigureAwait(true);
            await _dispatcher.InvokeAsync(() =>
            {
                Items.Clear();
                foreach (var g in games.OrderBy(g => g.GameName))
                {
                    Items.Add(new LeaderboardMenuItem(g.GameName, tag: g));
                }
                if (Items.Count == 0)
                {
                    Items.Add(new LeaderboardMenuItem(EmptyInfo, tag: null));
                }
                SelectedItem = Items.FirstOrDefault();
                Title = "Classement";
                var hasGames = Items.Any(i => i.Tag is LeaderboardGameDto);
                Status = hasGames ? "Choisissez un jeu. Échap : retour." : "Aucune information encore disponible. Échap : retour.";
            }, DispatcherPriority.Background);
        }
        catch (Exception ex)
        {
            await _dispatcher.InvokeAsync(() =>
            {
                Items.Clear();
                Title = "Classement";
                Status = $"Erreur : {ex.Message}";
            }, DispatcherPriority.Background);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ActivateSelectedAsync()
    {
        if (IsBusy) return;
        var selected = SelectedItem;
        if (selected == null) return;

        if (_page == LeaderboardPage.Games)
        {
            if (selected.Tag is not LeaderboardGameDto game)
            {
                return;
            }
            await LoadTopAsync(game).ConfigureAwait(true);
            return;
        }
    }

    private async Task LoadTopAsync(LeaderboardGameDto game)
    {
        IsBusy = true;
        Status = "Chargement...";
        try
        {
            var payload = await _service.GetTop10Async(game.GameType).ConfigureAwait(true);
            await _dispatcher.InvokeAsync(() =>
            {
                Items.Clear();
                _page = LeaderboardPage.Top;
                _selectedGame = game;
                Title = $"Classement - {game.GameName}";

                int rank = 1;
                foreach (var entry in payload.Entries.Take(10))
                {
                    Items.Add(new LeaderboardMenuItem($"{rank}. {entry.Username} - {entry.Wins} victoire(s), {entry.Losses} défaite(s)", tag: entry));
                    rank++;
                }

                if (Items.Count == 0)
                {
                    Items.Add(new LeaderboardMenuItem(EmptyInfo, tag: null));
                }

                SelectedItem = Items.FirstOrDefault();
                Status = "Échap : retour.";
            }, DispatcherPriority.Background);
        }
        catch (Exception ex)
        {
            await _dispatcher.InvokeAsync(() =>
            {
                Items.Clear();
                _page = LeaderboardPage.Games;
                Title = "Classement";
                Status = $"Erreur : {ex.Message}";
            }, DispatcherPriority.Background);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private enum LeaderboardPage
    {
        Games,
        Top
    }
}
