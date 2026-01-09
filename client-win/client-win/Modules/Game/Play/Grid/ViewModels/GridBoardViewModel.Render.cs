using System.Text.Json;
using System.Windows;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private void ApplyGridRender(GameStateDto state)
    {
        try
        {
            if (state.Extras.ValueKind != JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != JsonValueKind.Object ||
                !grid.TryGetProperty("render", out var render) ||
                render.ValueKind != JsonValueKind.Object ||
                !render.TryGetProperty("cells", out var cells) ||
                cells.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            for (var y = 0; y < Size; y++)
            {
                for (var x = 0; x < Size; x++)
                {
                    var idx = y * Size + x;
                    if (idx < 0 || idx >= Cells.Count) continue;
                    var cell = Cells[idx];

                    if (!cells.TryGetProperty(GridCellKey.From(x, y), out var cellNode) ||
                        cellNode.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    if (cellNode.TryGetProperty("walls", out var walls) &&
                        walls.ValueKind == JsonValueKind.Object)
                    {
                        cell.WallNorth = walls.TryGetProperty("n", out var n) && n.ValueKind == JsonValueKind.True;
                        cell.WallEast = walls.TryGetProperty("e", out var e) && e.ValueKind == JsonValueKind.True;
                        cell.WallSouth = walls.TryGetProperty("s", out var s) && s.ValueKind == JsonValueKind.True;
                        cell.WallWest = walls.TryGetProperty("w", out var w) && w.ValueKind == JsonValueKind.True;
                    }

                    if (cellNode.TryGetProperty("border", out var border) &&
                        border.ValueKind == JsonValueKind.Object)
                    {
                        var l = border.TryGetProperty("l", out var ll) && ll.ValueKind == JsonValueKind.Number && ll.TryGetDouble(out var ld) ? ld : 1;
                        var t = border.TryGetProperty("t", out var tt) && tt.ValueKind == JsonValueKind.Number && tt.TryGetDouble(out var td) ? td : 1;
                        var r = border.TryGetProperty("r", out var rr) && rr.ValueKind == JsonValueKind.Number && rr.TryGetDouble(out var rd) ? rd : 1;
                        var b = border.TryGetProperty("b", out var bb) && bb.ValueKind == JsonValueKind.Number && bb.TryGetDouble(out var bd) ? bd : 1;
                        cell.CellBorderThickness = new Thickness(l, t, r, b);
                    }
                }
            }
        }
        catch
        {
            // ignore
        }
    }
}

