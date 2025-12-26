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
}

internal enum PanelMode
{
    Shopping,
    Basket,
    Inventory
}
