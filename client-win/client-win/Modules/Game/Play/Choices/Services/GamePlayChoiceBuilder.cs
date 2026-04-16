using System.Collections.Generic;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.Services;

internal static class GamePlayChoiceBuilder
{
    internal static bool HasDiscardChoices(GameStateDto? state) => DiscardChoiceBuilder.HasDiscardChoices(state);

    internal static bool ShouldAutoOfferDiscardSelection(GameStateDto state, bool drawAvailable) =>
        DiscardChoiceBuilder.ShouldAutoOfferDiscardSelection(state, drawAvailable);

    internal static bool TryBuildDiscardChoices(GameStateDto state, out Dictionary<string, GameClientAction> choices) =>
        DiscardChoiceBuilder.TryBuildDiscardChoices(state, out choices);

    // Ask-card selection is now server-driven (pending + choiceActionsByIndex).
    // Keep a stub for backward compatibility with older client code paths.
    internal static bool TryBuildAskCardChoices(GameStateDto state, out Dictionary<string, GameClientAction> choices)
    {
        choices = new Dictionary<string, GameClientAction>(StringComparer.Ordinal);
        return false;
    }
}
