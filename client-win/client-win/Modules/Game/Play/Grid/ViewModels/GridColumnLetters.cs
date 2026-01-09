namespace client_win.Modules.Game.Play.Grid.ViewModels;

internal static class GridColumnLetters
{
    internal static string ToColumnLetters(int oneBasedColumn)
    {
        var n = oneBasedColumn <= 0 ? 1 : oneBasedColumn;
        var s = string.Empty;
        while (n > 0)
        {
            n--;
            s = (char)('A' + (n % 26)) + s;
            n /= 26;
        }
        return s;
    }
}

