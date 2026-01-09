using System.Linq;
using System.Text.Json;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private void SyncGridStatus(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object)
            {
                Status = string.Empty;
                return;
            }

            if (grid.TryGetProperty("statusLines", out var linesNode) &&
                linesNode.ValueKind == JsonValueKind.Array)
            {
                var lines = linesNode.EnumerateArray()
                    .Where(e => e.ValueKind == JsonValueKind.String)
                    .Select(e => (e.GetString() ?? string.Empty).Trim())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToArray();
                Status = lines.Length > 0 ? string.Join(" ", lines) : string.Empty;
                return;
            }

            Status = string.Empty;
        }
        catch
        {
            Status = string.Empty;
        }
    }
}

