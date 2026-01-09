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
