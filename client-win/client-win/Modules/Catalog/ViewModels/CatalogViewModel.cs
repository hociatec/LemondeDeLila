using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Core.Network;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Settings.Services;
using client_win.Modules.User.Services;

namespace client_win.Modules.Catalog.ViewModels;

public enum CatalogEscapeResult
{
    ToSubCategory,
    ToCategory,
    Closed
}

/// <summary>
/// Vue modèle inspirée du GameCatalogScreen Java : catégories -> sous-catégories -> jeux filtrés.
/// </summary>
public sealed class CatalogViewModel : ObservableObject
    , IDisposable
{
    private readonly ICatalogService _service;
    private readonly IOptionsService _options;
    private readonly ISessionService _session;
    private readonly Func<CatalogGame, Task> _openGame;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private readonly Dictionary<string, ICommand> _shelfActions = new();
    private readonly List<CatalogCategory> _actionShelves = new();
    private List<CatalogGame> _allGames = new();
    private CatalogCategory? _selectedCategory;
    private CatalogCategory? _selectedSubcategory;
    private CatalogGame? _selectedGame;
    private string _status = string.Empty;
    private bool _isBusy;
    private int _selectionRevision;
    private bool _refreshAfterBusy;
    private bool _isDisposed;
    private const string ActionPrefix = "action:";
    private static readonly CultureInfo CatalogCulture = CultureInfo.GetCultureInfo("fr-FR");
    private readonly EventHandler _onOptionsChanged;

    private static int CompareCatalogStrings(string? a, string? b)
    {
        // UX: sort A->Z consistently regardless of case/accents (é == e).
        var x = (a ?? string.Empty).Trim();
        var y = (b ?? string.Empty).Trim();
        var cmp = CatalogCulture.CompareInfo.Compare(
            x,
            y,
            CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace | CompareOptions.IgnoreSymbols);
        if (cmp != 0) return cmp;
        // Stable tie-breaker.
        return string.CompareOrdinal(x, y);
    }

    public CatalogViewModel(
        ICatalogService service,
        IOptionsService options,
        ISessionService session,
        Action onClose,
        Func<CatalogGame, Task> openGame,
        Func<Task<string>>? joinGame = null,
        Func<Task<string>>? openStoryBook = null,
        Func<Task<string>>? openVault = null)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _openGame = openGame ?? throw new ArgumentNullException(nameof(openGame));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        CloseCommand = new RelayCommand(_close);
        RefreshCommand = new AsyncRelayCommand(LoadAsync);
        _service.CacheInvalidated += OnCatalogInvalidated;

        _onOptionsChanged = (_, __) =>
        {
            if (_isDisposed) return;
            _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(ReloadGamesForCurrentSelection));
        };
        _options.Changed += _onOptionsChanged;

        if (joinGame != null)
        {
            AddShelfAction(
                id: $"{ActionPrefix}joinGame",
                "Rejoindre une partie",
                new AsyncRelayCommand(async () => Status = await joinGame().ConfigureAwait(true)));
        }
        if (openStoryBook != null)
        {
            AddShelfAction(
                id: $"{ActionPrefix}storyBook",
                "Livre des contes",
                new AsyncRelayCommand(async () => Status = await openStoryBook().ConfigureAwait(true)));
        }
        if (openVault != null)
        {
            AddShelfAction(
                id: $"{ActionPrefix}vault",
                "Mon coffre fort",
                new AsyncRelayCommand(async () => Status = await openVault().ConfigureAwait(true)));
        }

        Status = "Chargement du catalogue...";
        // IMPORTANT: ne pas muter les collections pendant que WPF est en train de mesurer/générer les conteneurs
        // (sinon ItemsControl peut lever ItemContainerGenerator.Verify()).
        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => RefreshCommand.Execute(null)));
    }

    public ObservableCollection<CatalogCategory> Shelves { get; } = new();
    public ObservableCollection<CatalogCategory> SubShelves { get; } = new();
    public ObservableCollection<CatalogGame> Games { get; } = new();

    public CatalogCategory? SelectedShelf
    {
        get => _selectedCategory;
        set
        {
            if (SetProperty(ref _selectedCategory, value))
            {
                if (IsActionShelf(value))
                {
                    // Les actions n'ont pas de sous-catégories/jeux.
                    SubShelves.Clear();
                    Games.Clear();
                    SelectedSubShelf = null;
                    SelectedGame = null;
                    Status = "Entrée : sélectionner une action ou une catégorie.";
                    return;
                }

                _selectionRevision++;
                ScheduleUpdateSubShelves(_selectionRevision);
                Status = "Sélectionnez une sous-catégorie ou un jeu.";
            }
        }
    }

    public CatalogCategory? SelectedSubShelf
    {
        get => _selectedSubcategory;
        set
        {
            if (SetProperty(ref _selectedSubcategory, value))
            {
                _selectionRevision++;
                ScheduleUpdateGames(_selectionRevision);
                Status = "Choisissez un jeu pour voir les détails.";
            }
        }
    }

    public CatalogGame? SelectedGame
    {
        get => _selectedGame;
        set
        {
            if (SetProperty(ref _selectedGame, value))
            {
                // Selection only, activation is handled by Enter/double-click.
            }
        }
    }

    public string Status
    {
        get => _status;
        set => SetProperty(ref _status, value);
    }

    public ICommand CloseCommand { get; }
    public ICommand RefreshCommand { get; }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            SetProperty(ref _isBusy, value);

            if (!value && _refreshAfterBusy && !_isDisposed)
            {
                _refreshAfterBusy = false;
                _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() => RefreshCommand.Execute(null)));
            }
        }
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _isDisposed = true;
        _service.CacheInvalidated -= OnCatalogInvalidated;
        _options.Changed -= _onOptionsChanged;
    }

    private bool IsAdmin()
    {
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        try
        {
            var parts = token.Split('.');
            if (parts.Length < 2) return false;

            static string Pad(string s)
            {
                s = s.Replace('-', '+').Replace('_', '/');
                var mod = s.Length % 4;
                return mod == 0 ? s : s + new string('=', 4 - mod);
            }

            var payloadJson = Encoding.UTF8.GetString(Convert.FromBase64String(Pad(parts[1])));
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("roles", out var rolesEl))
            {
                return false;
            }

            bool IsAdminRole(string? role) =>
                string.Equals(role, "ROLE_ADMIN", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase);

            if (rolesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var roleEl in rolesEl.EnumerateArray())
                {
                    if (roleEl.ValueKind == JsonValueKind.String && IsAdminRole(roleEl.GetString()))
                    {
                        return true;
                    }
                }
            }
            else if (rolesEl.ValueKind == JsonValueKind.String && IsAdminRole(rolesEl.GetString()))
            {
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    public bool TryActivateSelectedShelfAction()
    {
        var shelf = SelectedShelf;
        if (!IsActionShelf(shelf))
        {
            return false;
        }

        var id = shelf!.Id ?? string.Empty;
        if (!_shelfActions.TryGetValue(id, out var command))
        {
            return false;
        }

        if (command.CanExecute(null))
        {
            command.Execute(null);
        }
        return true;
    }

    private bool IsActionShelf(CatalogCategory? shelf)
    {
        var id = shelf?.Id ?? string.Empty;
        return id.StartsWith(ActionPrefix, StringComparison.Ordinal);
    }

    private void AddShelfAction(string id, string name, ICommand command)
    {
        var cat = new CatalogCategory(id, name);
        _actionShelves.Add(cat);
        _shelfActions[id] = command;
    }

    private void OnCatalogInvalidated(object? sender, EventArgs e)
    {
        if (_isDisposed)
        {
            return;
        }

        _dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (_isDisposed)
            {
                return;
            }

            Status = "Catalogue mis à jour, rechargement...";

            if (IsBusy)
            {
                _refreshAfterBusy = true;
                return;
            }

            RefreshCommand.Execute(null);
        }));
    }

    public CatalogEscapeResult HandleEscape(bool closeFromCategoryColumn = false, bool fromSubCategoryColumn = false)
    {
        if (closeFromCategoryColumn)
        {
            _close();
            return CatalogEscapeResult.Closed;
        }

        if (fromSubCategoryColumn && SelectedSubShelf != null)
        {
            Games.Clear();
            SelectedGame = null;
            SelectedSubShelf = null;
            Status = "Sous-catégorie désélectionnée. Choisissez une catégorie.";
            OnPropertyChanged(nameof(SelectedSubShelf));
            return CatalogEscapeResult.ToCategory;
        }

        // Si des jeux sont visibles, on remonte d'un niveau.
        if (Games.Count > 0)
        {
            Games.Clear();
            SelectedGame = null;
            Status = SubShelves.Count > 0
                ? "Jeux masqués. Choisissez une sous-catégorie."
                : "Jeux masqués. Retour aux catégories.";
            return SubShelves.Count > 0 ? CatalogEscapeResult.ToSubCategory : CatalogEscapeResult.ToCategory;
        }

        // Si une sous-catégorie est sélectionnée, on la désélectionne pour revenir au niveau catégorie.
        if (SelectedSubShelf != null)
        {
            SelectedSubShelf = null;
            SelectedGame = null;
            Status = "Sous-catégorie désélectionnée. Choisissez une catégorie.";
            OnPropertyChanged(nameof(SelectedSubShelf));
            return CatalogEscapeResult.ToCategory;
        }

        // Sinon, fermer le catalogue et revenir au menu.
        _close();
        return CatalogEscapeResult.Closed;
    }

    private async Task LoadAsync()
    {
        IsBusy = true;
        Status = "Chargement du catalogue...";

        // Nettoyer l'état en cas d'erreur précédente (sur le thread UI)
        await _dispatcher.InvokeAsync(() =>
        {
            Shelves.Clear();
            SubShelves.Clear();
            Games.Clear();
            _allGames = new List<CatalogGame>();
            SelectedGame = null;
            SelectedSubShelf = null;
            SelectedShelf = null;
        }, DispatcherPriority.Background);

        CatalogPayload payload;
        try
        {
            var network = NetworkConfiguration.Load();
            using var cts = new CancellationTokenSource(
                TimeSpan.FromSeconds(Math.Max(30, network.ReceiveTimeoutSeconds + 5)));
            payload = await _service.GetCatalogAsync(cts.Token).ConfigureAwait(true);
        }
        catch (OperationCanceledException)
        {
            Status = "Catalogue indisponible (timeout).";
            return;
        }
        catch (Exception ex)
        {
            Status = $"Erreur de chargement du catalogue : {ex.Message}";
            return;
        }
        finally
        {
            IsBusy = false;
        }

        // Appliquer le résultat sur le UI thread, déféré pour ne pas perturber un pass de layout en cours.
        await _dispatcher.InvokeAsync(() =>
        {
            _allGames = payload.Games?.ToList() ?? new List<CatalogGame>();
            var categories = payload.Categories ?? new List<CatalogCategory>();

            foreach (var action in _actionShelves)
            {
                Shelves.Add(action);
            }

            foreach (var cat in categories
                         .OrderBy(c => c?.Name ?? string.Empty, Comparer<string>.Create(CompareCatalogStrings)))
            {
                Shelves.Add(cat);
            }

            if (Shelves.Count == 0)
            {
                Status = "Aucune catégorie disponible.";
                return;
            }

            SelectedShelf = Shelves[0];
        }, DispatcherPriority.Background);
    }

    private void ScheduleUpdateSubShelves(int revision)
    {
        _dispatcher.InvokeAsync(() =>
        {
            if (revision != _selectionRevision)
            {
                return;
            }
            UpdateSubShelves();
        }, DispatcherPriority.Background);
    }

    private void ScheduleUpdateGames(int revision)
    {
        _dispatcher.InvokeAsync(() =>
        {
            if (revision != _selectionRevision)
            {
                return;
            }
            UpdateGames();
        }, DispatcherPriority.Background);
    }

    public void ReloadGamesForCurrentSelection()
    {
        _selectionRevision++;
        ScheduleUpdateGames(_selectionRevision);
    }

    private void UpdateSubShelves()
    {
        SubShelves.Clear();
        Games.Clear();
        SelectedSubShelf = null;
        SelectedGame = null;

        if (SelectedShelf == null)
        {
            return;
        }

        var children = SelectedShelf.Children ?? new List<CatalogCategory>();
        foreach (var cat in children
                     .OrderBy(c => c?.Name ?? string.Empty, Comparer<string>.Create(CompareCatalogStrings)))
        {
            SubShelves.Add(cat);
        }

        if (SubShelves.Count == 0)
        {
            // Pas de sous-catégories, afficher directement les jeux de la catégorie.
            SelectedSubShelf = null;
            _selectionRevision++;
            ScheduleUpdateGames(_selectionRevision);
        }
        else
        {
            SelectedSubShelf = SubShelves.Count > 0 ? SubShelves[0] : null;
        }
    }

    private void UpdateGames()
    {
        Games.Clear();
        SelectedGame = null;

        // Si des sous-catégories existent mais aucune n'est sélectionnée, ne pas charger les jeux
        // (permet à Esc de remonter directement au menu après avoir quitté une sous-catégorie).
        if (SubShelves.Count > 0 && SelectedSubShelf == null)
        {
            return;
        }

        string? categoryId = SelectedSubShelf?.Id ?? SelectedShelf?.Id;
        if (string.IsNullOrWhiteSpace(categoryId))
        {
            return;
        }

        var filtered = _allGames.Where(g => g.Categories.Contains(categoryId, StringComparer.OrdinalIgnoreCase)).ToList();
        var isAdmin = IsAdmin();
        var enableBeta = _options.Current.EnableBetaGames;
        filtered = filtered.Where(g =>
        {
            var status = (g?.Status ?? string.Empty).Trim().ToLowerInvariant();
            return status switch
            {
                "construction" => isAdmin,
                "beta" => isAdmin || enableBeta,
                _ => true
            };
        }).ToList();
        foreach (var game in filtered
                     .OrderBy(g => g?.Name ?? string.Empty, Comparer<string>.Create(CompareCatalogStrings))
                     .ThenBy(g => g?.Id ?? string.Empty, StringComparer.OrdinalIgnoreCase))
        {
            Games.Add(game);
        }

        if (Games.Count == 0)
        {
            Status = "Aucun jeu pour cette sélection.";
        }
        else
        {
            Status = $"Jeux disponibles : {Games.Count}.";
            SelectedGame = Games.Count > 0 ? Games[0] : null;
        }
    }

    public async Task ActivateSelectedGameAsync()
    {
        if (SelectedGame == null && Games.Count > 0)
        {
            SelectedGame = Games[0];
        }

        if (SelectedGame == null)
        {
            Status = "Selectionnez un jeu.";
            return;
        }

        IsBusy = true;
        try
        {
            Status = $"Ouverture de {SelectedGame.Name}...";
            await _openGame(SelectedGame).ConfigureAwait(true);
            Status = $"Jeu ouvert : {SelectedGame.Name}";
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

}
