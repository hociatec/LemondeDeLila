namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    private bool _wallNorth;
    public bool WallNorth
    {
        get => _wallNorth;
        set
        {
            if (SetProperty(ref _wallNorth, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _wallSouth;
    public bool WallSouth
    {
        get => _wallSouth;
        set
        {
            if (SetProperty(ref _wallSouth, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _wallWest;
    public bool WallWest
    {
        get => _wallWest;
        set
        {
            if (SetProperty(ref _wallWest, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private bool _wallEast;
    public bool WallEast
    {
        get => _wallEast;
        set
        {
            if (SetProperty(ref _wallEast, value))
            {
                UpdateAccessibleName();
            }
        }
    }
}

