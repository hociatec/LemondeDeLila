using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Shell.Services;
using client_win.Modules.Stats.Dtos;
using client_win.Modules.Stats.Services;

namespace client_win.Modules.Stats.ViewModels;

public enum StatsNavResult
{
    Stay,
    Moved,
    Closed
}

public sealed class StatsViewModel : ObservableObject, IShellContentCachePolicy
{
    private readonly IStatsService _stats;
    private readonly Func<Task>? _openLeaderboard;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly int? _targetUserId;
    private readonly string? _targetUsername;
    private StatsPage _page = StatsPage.Root;
    private MyGameStatsDto? _selectedGame;
    private MyGameStatsDto[] _loadedGames = Array.Empty<MyGameStatsDto>();
    private string _title = "Livre des contes";
    private string _status = string.Empty;
    private string _details = string.Empty;
    private bool _isBusy;
    private bool _initialized;
    private readonly bool _cacheable;

    private const string ConsultMyStats = "Consulter mon livre des contes";
    private const string OpenLeaderboard = "Classement";
    private const string EmptyInfo = "Aucune information encore disponible";

    public StatsViewModel(
        IStatsService stats,
        Action onClose,
        Func<Task>? openLeaderboard = null,
        int? targetUserId = null,
        string? targetUsername = null,
        bool cacheable = true)
    {
        _stats = stats ?? throw new ArgumentNullException(nameof(stats));
        _close = onClose ?? (() => { });
        _openLeaderboard = openLeaderboard;
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        _targetUserId = targetUserId;
        _targetUsername = targetUsername;
        _cacheable = cacheable && !HasTargetUser(targetUserId);

        Items = new ObservableCollection<StatsMenuItem>();
        ActivateCommand = new AsyncRelayCommand(ActivateSelectedAsync);
        Title = "Livre des contes";
        Status = "EntrÃ©e : sÃ©lectionner. Ã‰chap : retour.";

        if (HasTargetUser())
        {
            // Si on consulte le livre d'un autre utilisateur (depuis PrÃ©sence/Social),
            // ouvrir directement le contenu sans repasser par l'Ã©cran "Consulter le livre...".
            BuildRoot();
        }
        else
        {
            BuildRoot();
        }
    }

    public bool IsCacheable => _cacheable;

    // Called by the view once it is visible: ensures we don't trigger network calls before the UI is shown.
    public Task InitializeAsync()
    {
        if (_initialized)
        {
            return Task.CompletedTask;
        }

        _initialized = true;

        if (HasTargetUser())
        {
            // Si on consulte le livre d'un autre utilisateur (depuis PrÃƒÂ©sence/Social),
            // ouvrir directement le contenu sans repasser par l'ÃƒÂ©cran "Consulter le livre...".
            return LoadGamesAsync();
        }

        return Task.CompletedTask;
    }

    public ObservableCollection<StatsMenuItem> Items { get; }

    public StatsMenuItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }
    private StatsMenuItem? _selectedItem;

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

    public string Details
    {
        get => _details;
        private set => SetProperty(ref _details, value);
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set => SetProperty(ref _isBusy, value);
    }

    public AsyncRelayCommand ActivateCommand { get; }

    public StatsNavResult HandleEscape()
    {
        if (_page == StatsPage.Details)
        {
            if (_selectedGame != null)
            {
                BuildModes(_selectedGame);
                return StatsNavResult.Moved;
            }
            ShowGames();
            return StatsNavResult.Moved;
        }

        if (_page == StatsPage.Modes)
        {
            ShowGames();
            return StatsNavResult.Moved;
        }

        if (_page == StatsPage.Games)
        {
            if (HasTargetUser())
            {
                _close();
                return StatsNavResult.Closed;
            }

            BuildRoot();
            return StatsNavResult.Moved;
        }

        _close();
        return StatsNavResult.Closed;
    }

    private void BuildRoot()
    {
        _page = StatsPage.Root;
        Title = "Livre des contes";
        Details = string.Empty;
        Items.Clear();
        var consultLabel = _targetUserId.HasValue && _targetUserId.Value > 0
            ? $"Consulter le livre des contes de {_targetUsername ?? "cet utilisateur"}"
            : ConsultMyStats;
        Items.Add(new StatsMenuItem(consultLabel, tag: ConsultMyStats));
        if (!_targetUserId.HasValue || _targetUserId.Value <= 0)
        {
            Items.Add(new StatsMenuItem(OpenLeaderboard, tag: OpenLeaderboard));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "EntrÃ©e : consulter. Ã‰chap : retour.";
    }

    private static bool HasTargetUser(int? userId) => userId.HasValue && userId.Value > 0;

    private bool HasTargetUser() => HasTargetUser(_targetUserId);

    private void BuildGames()
    {
        _page = StatsPage.Games;
        _selectedGame = null;
        Title = _targetUserId.HasValue && _targetUserId.Value > 0
            ? $"Livre des contes de {_targetUsername ?? "cet utilisateur"}"
            : "Mon livre des contes";
        Details = string.Empty;
        var hasStats = Items.Any(i => i.Tag is MyGameStatsDto);
        Status = hasStats ? "Choisissez un jeu. Ã‰chap : retour." : "Aucune information encore disponible. Ã‰chap : retour.";
        SelectedItem = Items.FirstOrDefault();
    }

    private void BuildModes(MyGameStatsDto game)
    {
        _page = StatsPage.Modes;
        _selectedGame = game;
        Title = game.GameName;
        Items.Clear();
        Items.Add(new StatsMenuItem("Avec bots", tag: true));
        Items.Add(new StatsMenuItem("Sans bots", tag: false));
        SelectedItem = Items.FirstOrDefault();
        Details = string.Empty;
        Status = "Choisissez un mode (EntrÃ©e). Ã‰chap : retour.";
    }

    private void BuildDetails(string title, StatsCountsDto counts)
    {
        _page = StatsPage.Details;
        Title = title;
        Details = string.Empty;
        Items.Clear();
        Items.Add(new StatsMenuItem($"Parties terminÃ©es : {counts.Finished}."));
        Items.Add(new StatsMenuItem($"Parties quittÃ©es : {counts.Quit}."));
        Items.Add(new StatsMenuItem($"GagnÃ©es : {counts.Won}."));
        Items.Add(new StatsMenuItem($"Perdues : {counts.Lost}."));
        SelectedItem = Items.FirstOrDefault();
        Status = "Ã‰chap : retour.";
    }

    private async Task ActivateSelectedAsync()
    {
        if (IsBusy)
        {
            return;
        }

        var selected = SelectedItem;
        if (selected == null)
        {
            return;
        }

        if (_page == StatsPage.Root)
        {
            if (selected.Tag is string s && string.Equals(s, OpenLeaderboard, StringComparison.Ordinal))
            {
                if (_openLeaderboard != null)
                {
                    await _openLeaderboard().ConfigureAwait(true);
                }
                else
                {
                    Status = "Classement indisponible.";
                }
                return;
            }

            await LoadGamesAsync().ConfigureAwait(true);
            return;
        }

        if (_page == StatsPage.Games)
        {
            if (selected.Tag is not MyGameStatsDto game)
            {
                return;
            }
            BuildModes(game);
            return;
        }

        if (_page == StatsPage.Modes && _selectedGame != null)
        {
            bool withBots = selected.Tag is bool b && b;
            var label = withBots ? "Avec bots" : "Sans bots";
            BuildDetails($"{_selectedGame.GameName} - {label}", withBots ? _selectedGame.WithBots : _selectedGame.WithoutBots);
            return;
        }
    }

	    private async Task LoadGamesAsync()
	    {
	        IsBusy = true;
	        Status = "Chargement...";
	        Details = string.Empty;
	        try
	        {
	            var games = _targetUserId.HasValue && _targetUserId.Value > 0
	                ? await _stats.GetUserStatsAsync(_targetUserId.Value).ConfigureAwait(true)
	                : await _stats.GetMyStatsAsync().ConfigureAwait(true);
	            _loadedGames = games.OrderBy(g => g.GameName).ToArray();
	            await _dispatcher.InvokeAsync(() =>
	            {
	                ShowGames();
	            }, DispatcherPriority.Background);
        }
        catch (Exception ex)
        {
	            await _dispatcher.InvokeAsync(() =>
	            {
	                Items.Clear();
	                Items.Add(new StatsMenuItem(EmptyInfo, tag: null));
	                _page = StatsPage.Games;
	                Title = _targetUserId.HasValue && _targetUserId.Value > 0
	                    ? $"Livre des contes de {_targetUsername ?? "cet utilisateur"}"
	                    : "Mon livre des contes";
	                Details = string.Empty;
	                SelectedItem = Items.FirstOrDefault();
	                Status = $"Erreur : {ex.Message}";
	            }, DispatcherPriority.Background);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowGames()
    {
        Items.Clear();
        foreach (var g in _loadedGames)
        {
            Items.Add(new StatsMenuItem(g.GameName, tag: g));
        }
        if (Items.Count == 0)
        {
            Items.Add(new StatsMenuItem(EmptyInfo, tag: null));
        }
        BuildGames();
    }

    private enum StatsPage
    {
        Root,
        Games,
        Modes,
        Details
    }
}


