using System;
using System.Collections.Generic;
using client_win.Modules.Game.Play.Actions.ViewModels;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.ViewModels;

namespace client_win.Modules.Game.Play.State.Services;

internal sealed class GamePlayStatePresenter
{
    private readonly GamePlayStateProjector _projector;

    internal GamePlayStatePresenter(GamePlayStateProjector projector)
    {
        _projector = projector ?? throw new ArgumentNullException(nameof(projector));
    }

    internal PresentedGameState Present(GameStateDto state)
    {
        if (state == null)
        {
            return new PresentedGameState(
                isBotThinking: false,
                stateSummary: string.Empty,
                pendingText: string.Empty,
                actionsText: string.Empty,
                newLogMessages: Array.Empty<GameLogEntryDto>());
        }

        return new PresentedGameState(
            isBotThinking: state.BotThinking,
            stateSummary: GamePlayStateSummaryBuilder.Build(state),
            pendingText: GamePlayPendingTextBuilder.Build(state.Pending),
            actionsText: GamePlayActionsTextBuilder.Build(state),
            newLogMessages: _projector.ExtractNewLogMessages(state));
    }

    internal readonly record struct PresentedGameState(
        bool isBotThinking,
        string stateSummary,
        string pendingText,
        string actionsText,
        IEnumerable<GameLogEntryDto> newLogMessages);
}
