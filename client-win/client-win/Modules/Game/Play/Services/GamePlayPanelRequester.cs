using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayPanelRequester
{
    private TaskCompletionSource<GameStateDto>? _nextStateTcs;
    private CancellationTokenSource? _panelRequestCts;
    private int _panelRequestSeq;

    internal void OnStateUpdated(GameStateDto state)
    {
        _nextStateTcs?.TrySetResult(state);
    }

    internal async Task<GameStateDto?> RequestFreshStateAsync(GameSession? session)
    {
        if (session == null)
        {
            return null;
        }

        CancellationTokenSource? cts = null;
        TaskCompletionSource<GameStateDto>? tcs = null;
        try
        {
            _panelRequestSeq++;
            var seq = _panelRequestSeq;

            _panelRequestCts?.Cancel();
            _panelRequestCts?.Dispose();
            cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            _panelRequestCts = cts;

            tcs = new TaskCompletionSource<GameStateDto>(TaskCreationOptions.RunContinuationsAsynchronously);
            _nextStateTcs = tcs;

            await session.RequestStateAsync(cts.Token).ConfigureAwait(true);

            var completed = await Task.WhenAny(
                    tcs.Task,
                    Task.Delay(Timeout.InfiniteTimeSpan, cts.Token))
                .ConfigureAwait(true);

            if (seq != _panelRequestSeq)
            {
                return null;
            }

            if (completed == tcs.Task)
            {
                return await tcs.Task.ConfigureAwait(true);
            }

            return session.LastState;
        }
        catch
        {
            return session.LastState;
        }
        finally
        {
            if (tcs != null && ReferenceEquals(_nextStateTcs, tcs))
            {
                _nextStateTcs = null;
            }
            if (cts != null && ReferenceEquals(_panelRequestCts, cts))
            {
                _panelRequestCts = null;
                cts.Dispose();
            }
        }
    }

    internal static string BuildPanelHistoryMessage(GameStateDto state, PanelMode mode)
    {
        var view = GamePlayExtrasParser.ExtractCurrentPlayerView(state);
        string[] items;
        string title;

        switch (mode)
        {
            case PanelMode.Shopping:
                title = "Shopping list";
                items = view.ShoppingList;
                break;
            case PanelMode.Basket:
                title = "Panier";
                items = view.Basket;
                break;
            case PanelMode.Inventory:
                title = "Inventaire";
                items = view.Inventory;
                break;
            default:
                return string.Empty;
        }

        if (items.Length == 0)
        {
            return $"{title}: (vide)";
        }

        const int max = 12;
        var shown = items.Length > max ? items[..max] : items;
        var body = string.Join(", ", shown);
        if (items.Length > max)
        {
            body += $", ... (+{items.Length - max})";
        }

        return $"{title}: {body}";
    }

    internal static string BuildPositionHistoryMessage(GameStateDto state)
    {
        var playerId = GamePlayExtrasParser.ExtractCurrentPlayerId(state);
        var board = state.Board;
        var position = TryGetFromMap(board?.Positions, playerId);
        var lap = TryGetFromMap(board?.Laps, playerId);

        var totalTiles = TryGetTilesCount(board?.Tiles);

        if (position == null || totalTiles == null || totalTiles.Value <= 0)
        {
            return "Case: inconnue.";
        }

        var caseNumber = position.Value + 1; // user-friendly 1-based
        var tourPlateau = lap != null ? lap.Value.ToString() : "?";
        return $"Tour plateau {tourPlateau}, case {caseNumber}/{totalTiles.Value}.";
    }

    private static int? TryGetTilesCount(System.Text.Json.JsonElement? tiles)
    {
        if (tiles == null)
        {
            return null;
        }

        var t = tiles.Value;
        return t.ValueKind == System.Text.Json.JsonValueKind.Array ? t.GetArrayLength() : null;
    }

    private static int? TryGetFromMap(System.Collections.Generic.Dictionary<string, int>? map, int? playerId)
    {
        if (map == null || playerId == null)
        {
            return null;
        }

        var key = playerId.Value.ToString();
        if (map.TryGetValue(key, out var v))
        {
            return v;
        }

        var alt = map.Keys.FirstOrDefault(k => string.Equals(k, key, StringComparison.OrdinalIgnoreCase));
        if (alt != null && map.TryGetValue(alt, out var v2))
        {
            return v2;
        }

        return null;
    }

    private static string? ExtractTileLabel(System.Text.Json.JsonElement? tiles, int? position)
    {
        if (tiles == null || position == null)
        {
            return null;
        }

        var t = tiles.Value;
        if (t.ValueKind != System.Text.Json.JsonValueKind.Array)
        {
            return null;
        }

        var idx = position.Value;
        if (idx < 0)
        {
            return null;
        }

        var i = 0;
        foreach (var tile in t.EnumerateArray())
        {
            if (i == idx)
            {
                if (tile.ValueKind != System.Text.Json.JsonValueKind.Object)
                {
                    return null;
                }

                if (tile.TryGetProperty("label", out var label) &&
                    label.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var s = label.GetString();
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }

                if (tile.TryGetProperty("type", out var type) &&
                    type.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var s = type.GetString();
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }

                return null;
            }
            i++;
        }

        return null;
    }
}

internal enum PanelMode
{
    Shopping,
    Basket,
    Inventory
}
