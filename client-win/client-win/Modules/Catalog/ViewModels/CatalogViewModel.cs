using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows;
using System.Windows.Threading;
using client_win.Core;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Catalog.Services;
using client_win.Modules.Game.Models;
using client_win.Modules.Game.Services;

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
{
    private readonly ICatalogService _service;
    private readonly IRoomRealtimeService _roomRealtime;
    private readonly IRoomTableNavigator _roomNavigator;
    private readonly Action _close;
    private readonly Dispatcher _dispatcher;
    private List<CatalogGame> _allGames = new();
    private CatalogCategory? _selectedCategory;
    private CatalogCategory? _selectedSubcategory;
    private CatalogGame? _selectedGame;
    private string _status = string.Empty;
    private bool _isBusy;
    private int _selectionRevision;

    public CatalogViewModel(ICatalogService service, IRoomRealtimeService roomRealtime, IRoomTableNavigator roomNavigator, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _roomRealtime = roomRealtime ?? throw new ArgumentNullException(nameof(roomRealtime));
        _roomNavigator = roomNavigator ?? throw new ArgumentNullException(nameof(roomNavigator));
        _close = onClose ?? (() => { });
        _dispatcher = Application.Current?.Dispatcher ?? Dispatcher.CurrentDispatcher;
        CloseCommand = new RelayCommand(_close);
        RefreshCommand = new AsyncRelayCommand(LoadAsync);
        Status = "Chargement du catalogue...";
        RefreshCommand.Execute(null);
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
        }
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
            payload = await _service.GetCatalogAsync().ConfigureAwait(true);
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

        _allGames = payload.Games?.ToList() ?? new List<CatalogGame>();
        var categories = payload.Categories ?? new List<CatalogCategory>();

        foreach (var cat in categories)
        {
            Shelves.Add(cat);
        }

        if (Shelves.Count == 0)
        {
            Status = "Aucune catégorie disponible.";
            return;
        }

        // Déférer la sélection initiale pour éviter une réentrance pendant la génération des items WPF
        SelectedShelf = Shelves.Count > 0 ? Shelves[0] : null;
        Status = "Choisissez une catégorie.";
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
        foreach (var cat in children)
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
        foreach (var game in filtered)
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
        if (SelectedGame == null)
        {
            Status = "Selectionnez un jeu.";
            return;
        }

        int maxPlayers = SelectedGame.MaxPlayers > 0 ? SelectedGame.MaxPlayers : 4;
        string name = $"Table {SelectedGame.Name}";

        IsBusy = true;
        try
        {
            Status = "Creation de la table...";
            var created = await _roomRealtime.CreateRoomAsync(
                new CreateRoomRequest(SelectedGame.Code, name, maxPlayers, false)).ConfigureAwait(true);

            if (created == null)
            {
                Status = "Creation impossible.";
                return;
            }

            Status = $"Table creee: #{created.RoomId} ({created.GameType}).";
            _roomNavigator.OpenRoom(new RoomLaunchRequest(created.RoomId, created.GameType, created.RoomName, spectator: false));
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
