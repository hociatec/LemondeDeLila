using System.Collections.ObjectModel;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    private ObservableCollection<string> _cellTags;
    public ObservableCollection<string> CellTags
    {
        get => _cellTags;
        set
        {
            if (SetProperty(ref _cellTags, value ?? new ObservableCollection<string>()))
            {
                UpdateAccessibleName();
            }
        }
    }

    private ObservableCollection<string> _actionLabels;
    public ObservableCollection<string> ActionLabels
    {
        get => _actionLabels;
        set
        {
            if (SetProperty(ref _actionLabels, value ?? new ObservableCollection<string>()))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _canPlaceWallH;
    public bool CanPlaceWallH
    {
        get => _canPlaceWallH;
        set
        {
            if (SetProperty(ref _canPlaceWallH, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _canPlaceWallV;
    public bool CanPlaceWallV
    {
        get => _canPlaceWallV;
        set
        {
            if (SetProperty(ref _canPlaceWallV, value))
            {
                UpdateAccessibleName();
            }
        }
    }
}
