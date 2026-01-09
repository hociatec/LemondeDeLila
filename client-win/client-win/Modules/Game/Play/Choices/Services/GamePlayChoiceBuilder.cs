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

    internal static bool TryBuildAskCardChoices(GameStateDto state, out Dictionary<string, GameClientAction> choices) =>
        AskCardChoiceBuilder.TryBuildAskCardChoices(state, out choices);
}

