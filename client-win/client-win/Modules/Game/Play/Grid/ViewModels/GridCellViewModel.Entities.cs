using System.Collections.ObjectModel;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    private string _glyph = string.Empty;
    public string Glyph
    {
        get => _glyph;
        set
        {
            if (SetProperty(ref _glyph, value ?? string.Empty))
            {
                OnPropertyChanged(nameof(Display));
                UpdateAccessibleName();
            }
        }
    }

    private int _entitiesCount;
    public int EntitiesCount
    {
        get => _entitiesCount;
        set
        {
            if (SetProperty(ref _entitiesCount, value))
            {
                OnPropertyChanged(nameof(HasEntities));
                UpdateAccessibleName();
            }
        }
    }

    public bool HasEntities => EntitiesCount > 0;

    private bool _hasOwnPawn;
    public bool HasOwnPawn
    {
        get => _hasOwnPawn;
        set
        {
            if (SetProperty(ref _hasOwnPawn, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private string _ownPawnUsername = string.Empty;
    public string OwnPawnUsername
    {
        get => _ownPawnUsername;
        set
        {
            if (SetProperty(ref _ownPawnUsername, value ?? string.Empty))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _hasOpponentPawn;
    public bool HasOpponentPawn
    {
        get => _hasOpponentPawn;
        set
        {
            if (SetProperty(ref _hasOpponentPawn, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private string _opponentPawnUsername = string.Empty;
    public string OpponentPawnUsername
    {
        get => _opponentPawnUsername;
        set
        {
            if (SetProperty(ref _opponentPawnUsername, value ?? string.Empty))
            {
                UpdateAccessibleName();
            }
        }
    }

    private ObservableCollection<string> _entityTypes = new();
    public ObservableCollection<string> EntityTypes
    {
        get => _entityTypes;
        set
        {
            if (SetProperty(ref _entityTypes, value ?? new ObservableCollection<string>()))
            {
                UpdateAccessibleName();
            }
        }
    }
}
