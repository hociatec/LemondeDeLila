using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesStateSynchronizer
{
    private readonly GamePlayLocalChoices _localChoices;
    private readonly GamePlayChoicesListController _list;

    internal GamePlayChoicesStateSynchronizer(GamePlayLocalChoices localChoices, GamePlayChoicesListController list)
    {
        _localChoices = localChoices ?? throw new ArgumentNullException(nameof(localChoices));
        _list = list ?? throw new ArgumentNullException(nameof(list));
    }

    internal void UpdateFromState(
        GameStateDto state,
        int? viewerPlayerId,
        Func<GameStateDto, bool> canStartAskCardSelection,
        Action<string> setLabel)
    {
        if (state == null) return;

        if (ShouldHidePendingChoices(state, viewerPlayerId))
        {
            _localChoices.Clear();
            setLabel(string.Empty);
            _list.Clear();
            return;
        }

        var serverChoices = PendingChoicesReader.ExtractServerPendingChoices(state);
        var hasServerPendingChoices = serverChoices.Count > 0;

        if (hasServerPendingChoices)
        {
            _localChoices.Clear();
            setLabel(PendingChoicesReader.BuildServerChoicesLabel(state.Pending));
            var type = (state.Pending?.Type ?? string.Empty).Trim();
            var isQuiz = string.Equals(type, "quiz", StringComparison.OrdinalIgnoreCase);
            _list.Apply(serverChoices, autoSelectFirst: !isQuiz);
            return;
        }

        if (_localChoices.IsMode("ask") &&
            _localChoices.HasChoices &&
            canStartAskCardSelection(state))
        {
            return;
        }

        if (GamePlayChoiceBuilder.ShouldAutoOfferDiscardSelection(state, drawAvailable: HasAction(state, "draw")) &&
            GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var discardChoices))
        {
            ApplyLocalChoices("discard_auto", discardChoices, setLabel);
            return;
        }

        _localChoices.Clear();
        setLabel(string.Empty);
        _list.Clear();
    }

    internal bool TryStartDiscardSelection(GameStateDto state, Action<string> announce, Action<string> setLabel)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("discard", choices, setLabel);
        var label = "Choisissez une carte à défausser dans la liste, puis Entrée.";
        setLabel(label);
        announce(label);
        return true;
    }

    internal bool TryStartAskSelection(GameStateDto state, Action<string> announce, Action<string> setLabel)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildAskCardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("ask", choices, setLabel);
        var label = "Choisissez une demande dans la liste, puis Entrée.";
        setLabel(label);
        announce(label);
        return true;
    }

    internal void ClearAllChoices(Action<string> setLabel)
    {
        _localChoices.Clear();
        setLabel(string.Empty);
        _list.Clear();
    }

    private static bool ShouldHidePendingChoices(GameStateDto state, int? viewerPlayerId)
    {
        var pendingPlayerId = state.Pending?.PlayerId;
        var pendingType = (state.Pending?.Type ?? string.Empty).Trim();
        var isQuiz = string.Equals(pendingType, "quiz", StringComparison.OrdinalIgnoreCase);
        var canAnswerQuiz = !isQuiz || HasAction(state, "answer_quiz");
        // Si le viewer est inconnu (serveur ancien / payload incomplet), on masque les choix de quiz
        // sauf si on détecte une action de réponse (joueur actif).
        if (viewerPlayerId == null)
        {
            return isQuiz && !canAnswerQuiz;
        }

        if (pendingPlayerId != null &&
            viewerPlayerId != null &&
            pendingPlayerId.Value != viewerPlayerId.Value)
        {
            return true;
        }

        if (isQuiz && !canAnswerQuiz)
        {
            return true;
        }

        return false;
    }

    private void ApplyLocalChoices(string mode, Dictionary<string, GameClientAction> choices, Action<string> setLabel)
    {
        _localChoices.Set(mode, choices);
        setLabel(string.Empty);
        _list.Apply(choices.Keys.ToList());
    }

    private static bool HasAction(GameStateDto state, string actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return false;
        }

        var actions = state.Actions;
        if (actions == null || actions.Count == 0)
        {
            return false;
        }

        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }
}
