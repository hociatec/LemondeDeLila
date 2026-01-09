using System;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.State.ViewModels;

internal static class GamePlayStateSummaryBuilder
{
    internal static string Build(GameStateDto state)
    {
        var status = string.IsNullOrWhiteSpace(state.Status) ? "?" : state.Status;
        var phase = string.IsNullOrWhiteSpace(state.Phase) ? "?" : state.Phase;
        var label = state.Turn?.Label;
        return !string.IsNullOrWhiteSpace(label)
            ? $"{status} - {label} (phase: {phase}, tour: {state.TurnIndex}, manche: {state.Round})"
            : $"{status} (phase: {phase}, tour: {state.TurnIndex}, manche: {state.Round})";
    }
}
