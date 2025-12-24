using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
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
    private List<CatalogGame> _allGames = new();
    private CatalogCategory? _selectedCategory;
    private CatalogCategory? _selectedSubcategory;
    private CatalogGame? _selectedGame;
    private string _status = string.Empty;
    private string _newRoomName = string.Empty;
    private int _newMaxPlayers = 4;
    private bool _newIsPrivate;
    private bool _isBusy;

    public CatalogViewModel(ICatalogService service, IRoomRealtimeService roomRealtime, IRoomTableNavigator roomNavigator, Action onClose)
    {
        _service = service ?? throw new ArgumentNullException(nameof(service));
        _roomRealtime = roomRealtime ?? throw new ArgumentNullException(nameof(roomRealtime));
        _roomNavigator = roomNavigator ?? throw new ArgumentNullException(nameof(roomNavigator));
        _close = onClose ?? (() => { });
        CloseCommand = new RelayCommand(_close);
        RefreshCommand = new AsyncRelayCommand(LoadAsync);
        CreateTableCommand = new AsyncRelayCommand(CreateTableAsync, CanCreateTable);
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
                UpdateSubShelves();
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
                UpdateGames();
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
                if (_selectedGame != null)
                {
                    if (string.IsNullOrWhiteSpace(NewRoomName))
                    {
                        NewRoomName = _selectedGame.Name;
                    }
                    if (_selectedGame.MaxPlayers > 0)
                    {
                        NewMaxPlayers = _selectedGame.MaxPlayers;
                    }
                }
                UpdateCommands();
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
    public ICommand CreateTableCommand { get; }

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

        // Nettoyer l'état en cas d'erreur précédente
        Shelves.Clear();
        SubShelves.Clear();
        Games.Clear();
        _allGames = new List<CatalogGame>();
        SelectedGame = null;
        SelectedSubShelf = null;
        SelectedShelf = null;

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

        SelectedShelf = Shelves.Count > 0 ? Shelves[0] : null;
        Status = "Choisissez une catégorie.";
    }

    public void ReloadGamesForCurrentSelection()
    {
        UpdateGames();
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
            UpdateGames();
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

    private async Task CreateTableAsync()
    {
        if (SelectedGame == null)
        {
            Status = "Selectionnez un jeu.";
            return;
        }

        int maxPlayers = NewMaxPlayers < 1 ? SelectedGame.MaxPlayers : NewMaxPlayers;
        if (maxPlayers < 1)
        {
            maxPlayers = 2;
        }

        IsBusy = true;
        try
        {
            Status = "Creation de la table...";
            var created = await _roomRealtime.CreateRoomAsync(
                new CreateRoomRequest(SelectedGame.Code, NewRoomName, maxPlayers, NewIsPrivate)).ConfigureAwait(true);

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

    private bool CanCreateTable()
    {
        return !IsBusy && SelectedGame != null;
    }

    private void UpdateCommands()
    {
        (CreateTableCommand as AsyncRelayCommand)?.RaiseCanExecuteChanged();
    }
}
