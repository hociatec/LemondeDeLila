using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayActionDispatcher
{
    internal bool TryBuildPendingChoiceAction(
        GameSession session,
        string selectedChoice,
        out GameClientAction? action)
    {
        action = null;
        if (session == null) return false;
        if (!session.IsConnected) return false;
        if (string.IsNullOrWhiteSpace(selectedChoice)) return false;

        var state = session.LastState;
        if (state?.Pending?.Choices == null || state.Pending.Choices.Count == 0)
        {
            return false;
        }

        var index = state.Pending.Choices.FindIndex(c =>
            string.Equals(c?.Trim(), selectedChoice.Trim(), StringComparison.Ordinal));
        if (index < 0)
        {
            return false;
        }

        var available = state.Actions ?? new List<GameAvailableActionDto>();
        if (available.Count == 0) return false;

        var pendingType = (state.Pending.Type ?? string.Empty).Trim();
        var candidates = FilterChoiceActions(available, pendingType);
        if (candidates.Count != state.Pending.Choices.Count)
        {
            candidates = FilterChoiceActions(available, string.Empty);
        }

        if (index >= candidates.Count) return false;

        var chosen = candidates[index];
        if (string.IsNullOrWhiteSpace(chosen.Type)) return false;

        action = new GameClientAction(type: chosen.Type, payload: chosen.Payload);
        return true;
    }

    private static List<GameAvailableActionDto> FilterChoiceActions(
        List<GameAvailableActionDto> actions,
        string pendingType)
    {
        if (actions.Count == 0) return new List<GameAvailableActionDto>();

        var normalized = pendingType?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalized == "quiz")
        {
            return actions
                .Where(a => string.Equals(a.Type, "answer_quiz", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (normalized == "exchange")
        {
            return actions
                .Where(a =>
                    string.Equals(a.Type, "exchange_choose_target", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(a.Type, "exchange_choose_give", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return actions
            .Where(a =>
                !string.Equals(a.Type, "roll", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(a.Type, "ROLL_DICE", StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    internal bool CanSendSimpleAction(GameSession? session, string actionType)
    {
        if (session == null) return false;
        if (!session.IsConnected) return false;
        if (string.IsNullOrWhiteSpace(actionType)) return false;
        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0) return false;
        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }

    internal bool CanSendRoll(GameSession? session)
    {
        if (session == null) return false;
        if (!session.IsConnected) return false;
        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0) return false;
        return actions.Any(a =>
            string.Equals(a.Type, "roll", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(a.Type, "ROLL_DICE", StringComparison.OrdinalIgnoreCase));
    }

    internal bool CanSendAnswer(GameSession? session, string answer)
    {
        if (session == null) return false;
        if (!session.IsConnected) return false;
        if (string.IsNullOrWhiteSpace(answer)) return false;

        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0) return false;

        foreach (var action in actions)
        {
            if (!string.Equals(action.Type, "answer_quiz", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            if (action.Payload.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                continue;
            }
            if (action.Payload.TryGetProperty("answer", out var a) &&
                a.ValueKind == System.Text.Json.JsonValueKind.String &&
                string.Equals(a.GetString(), answer, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    internal async Task SendSimpleActionAsync(
        GameSession session,
        string actionType,
        CancellationToken cancellationToken = default)
    {
        if (!CanSendSimpleAction(session, actionType)) return;
        await session.SendActionsAsync(
                new[] { new GameClientAction(type: actionType) },
                cancellationToken)
            .ConfigureAwait(false);
    }

    internal async Task SendRollAsync(GameSession session, CancellationToken cancellationToken = default)
    {
        if (!CanSendRoll(session)) return;

        var types = session.LastState?.Actions?
                        .Select(a => a.Type)
                        .Where(t => !string.IsNullOrWhiteSpace(t))
                        .ToList()
                    ?? new System.Collections.Generic.List<string>();

        var type = types.Any(t => string.Equals(t, "roll", StringComparison.OrdinalIgnoreCase))
            ? "roll"
            : "ROLL_DICE";

        if (!types.Any(t => string.Equals(t, type, StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        await session.SendActionsAsync(
                new[] { new GameClientAction(type: type) },
                cancellationToken)
            .ConfigureAwait(false);
    }

    internal async Task SendAnswerQuizAsync(
        GameSession session,
        string answer,
        CancellationToken cancellationToken = default)
    {
        if (!CanSendAnswer(session, answer)) return;
        await session.SendActionsAsync(
                new[] { new GameClientAction(type: "answer_quiz", payload: new { answer }) },
                cancellationToken)
            .ConfigureAwait(false);
    }
}
