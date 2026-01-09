using System.Threading.Tasks;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Panels.Services;

internal sealed class GamePlayPanelRequester
{
    private readonly GamePlayFreshStateRequester _freshState = new();

    internal void OnStateUpdated(GameStateDto state) => _freshState.OnStateUpdated(state);

    internal Task<GameStateDto?> RequestFreshStateAsync(GameSession? session) =>
        _freshState.RequestFreshStateAsync(session);

    internal static string BuildPanelHistoryMessage(GameStateDto state, string panelId) =>
        GamePlayPanelHistoryMessageBuilder.BuildPanelHistoryMessage(state, panelId);
}

