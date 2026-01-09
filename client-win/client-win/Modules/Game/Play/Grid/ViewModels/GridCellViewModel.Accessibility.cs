namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    public string AccessibleName => CellRef;

    private void UpdateAccessibleName()
    {
        OnPropertyChanged(nameof(CellRef));
        OnPropertyChanged(nameof(AccessibleName));
    }

    public override string ToString() => CellRef;
}
