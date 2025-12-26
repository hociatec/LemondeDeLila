using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Dtos;

namespace client_win.Modules.Game.Play.Services;

internal sealed class GamePlayActionDispatcher
{
    internal bool CanSendSimpleAction(GameSession? session, string actionType)
    {
        if (session == null) return false;
        if (string.IsNullOrWhiteSpace(actionType)) return false;
        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0) return false;
        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }

    internal bool CanSendRoll(GameSession? session)
    {
        if (session == null) return false;
        var actions = session.LastState?.Actions;
        if (actions == null || actions.Count == 0) return false;
        return actions.Any(a =>
            string.Equals(a.Type, "roll", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(a.Type, "ROLL_DICE", StringComparison.OrdinalIgnoreCase));
    }

    internal bool CanSendAnswer(GameSession? session, string answer)
    {
        if (session == null) return false;
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

