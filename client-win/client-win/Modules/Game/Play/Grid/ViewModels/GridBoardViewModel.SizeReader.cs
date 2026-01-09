using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private static bool TryReadGridSize(GameStateDto state, out int size)
    {
        size = 0;
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (state.Extras.TryGetProperty("grid", out var grid) &&
                grid.ValueKind == JsonValueKind.Object &&
                grid.TryGetProperty("size", out var sizeNode))
            {
                if (sizeNode.ValueKind == JsonValueKind.Number && sizeNode.TryGetInt32(out var asInt))
                {
                    size = asInt;
                    return size > 0;
                }

                if (sizeNode.ValueKind == JsonValueKind.String &&
                    int.TryParse(sizeNode.GetString(), out var parsed))
                {
                    size = parsed;
                    return size > 0;
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
    }
}
