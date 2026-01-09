namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    public string Display
    {
        get => Glyph ?? string.Empty;
    }
}
