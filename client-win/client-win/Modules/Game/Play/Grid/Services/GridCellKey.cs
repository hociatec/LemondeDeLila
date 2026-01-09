using client_win.Modules.Game.Play.Grid.ViewModels;

namespace client_win.Modules.Game.Play.Grid.Services;

internal static class GridCellKey
{
    internal static string From(int x, int y) => $"{x},{y}";

    internal static string From(GridCellViewModel cell) => $"{cell.X},{cell.Y}";
}

