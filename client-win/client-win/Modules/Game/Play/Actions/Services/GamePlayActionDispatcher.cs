using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Common;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Actions.Services;

internal sealed class GamePlayActionDispatcher
{
    private static string NormalizeChoiceForServer(string choice) =>
        (choice ?? string.Empty)
            .Replace("\u2060", string.Empty) // WORD JOINER (used to make duplicate labels distinct for a11y)
            .Trim();

    internal bool TryBuildPendingChoiceAction(
        GameSession session,
        string selectedChoice,
        int selectedChoiceIndex,
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

        var index = selectedChoiceIndex;
        if (index < 0 || index >= state.Pending.Choices.Count)
        {
            var wanted = NormalizeChoiceForServer(selectedChoice);
            index = state.Pending.Choices.FindIndex(c =>
                string.Equals(NormalizeChoiceForServer(c ?? string.Empty), wanted, StringComparison.Ordinal));
        }
        if (index < 0)
        {
            return false;
        }

        var available = state.Actions ?? new List<GameAvailableActionDto>();
        if (available.Count == 0) return false;

        var pendingType = (state.Pending.Type ?? string.Empty).Trim();

        // Preferred path: backend provides an explicit mapping choice index -> action.
        // This keeps the client "thin" and avoids game-specific heuristics.
        if (TryBuildActionFromServerChoiceActions(state.Pending, index, out var mapped))
        {
            action = mapped;
            return true;
        }

        // Cas spécial: "choose_pawn" (ex: petits chevaux).
        // On construit l'action depuis `pending.data.moves`, aligné sur `pending.choices`.
        if (PawnPendingTypes.IsPawnPendingType(pendingType))
        {
            if (TryBuildChoosePawnFromPendingData(state.Pending, selectedChoice, index, available, out var choosePawnAction))
            {
                action = choosePawnAction;
                return true;
            }

            if (TryBuildMovePawnFromPendingData(state.Pending, index, available, out var movePawnAction))
            {
                action = movePawnAction;
                return true;
            }
        }

        // Cas spécial: confirmation d'échange (Accepter/Refuser).
        // Le backend expose généralement 2 choix texte, et 2 actions correspondantes (exchange_accept/exchange_refuse).
        if (string.Equals(pendingType, "exchange", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedChoice = selectedChoice.Trim().ToLowerInvariant();
            if (normalizedChoice is "accepter" or "refuser")
            {
                var targetType = normalizedChoice == "accepter"
                    ? "exchange_accept"
                    : "exchange_refuse";
                var matched = available.FirstOrDefault(a =>
                    string.Equals(a.Type, targetType, StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(matched?.Type))
                {
                    action = new GameClientAction(type: matched!.Type, payload: matched.Payload);
                    return true;
                }
            }
        }

        var candidates = FilterChoiceActions(available, pendingType);

        // Quiz: match by answer string rather than by list index, because:
        // - the UI may inject invisible chars (a11y distinct) into labels
        // - the server may not guarantee action ordering
        if (string.Equals(pendingType, "quiz", StringComparison.OrdinalIgnoreCase))
        {
            var answer = NormalizeChoiceForServer(selectedChoice);
            if (answer.Length == 0)
            {
                return false;
            }

            // Prefer server-provided payloads whenever possible (some backends expect `answerIndex`).
            var matchedByIndex = available.FirstOrDefault(a =>
            {
                if (!string.Equals(a.Type, "answer_quiz", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (a.Payload.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (a.Payload.TryGetProperty("answerIndex", out var idxNode) &&
                    idxNode.ValueKind == JsonValueKind.Number &&
                    idxNode.TryGetInt32(out var serverIndex))
                {
                    return serverIndex == index;
                }

                return false;
            });

            if (!string.IsNullOrWhiteSpace(matchedByIndex?.Type))
            {
                action = new GameClientAction(type: matchedByIndex!.Type, payload: matchedByIndex.Payload);
                return true;
            }

            var matchedByAnswer = available.FirstOrDefault(a =>
            {
                if (!string.Equals(a.Type, "answer_quiz", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (a.Payload.ValueKind != JsonValueKind.Object)
                {
                    return false;
                }

                if (a.Payload.TryGetProperty("answer", out var answerNode) &&
                    answerNode.ValueKind == JsonValueKind.String)
                {
                    var serverAnswer = (answerNode.GetString() ?? string.Empty).Trim();
                    return string.Equals(serverAnswer, answer, StringComparison.OrdinalIgnoreCase);
                }

                return false;
            });

            if (!string.IsNullOrWhiteSpace(matchedByAnswer?.Type))
            {
                action = new GameClientAction(type: matchedByAnswer!.Type, payload: matchedByAnswer.Payload);
                return true;
            }

            // Fallback: best-effort when the backend exposes quiz answers as allowed actions but with an unknown payload shape.
            // If we detect index-style actions, send `{ answerIndex }`, otherwise send `{ answer }`.
            var hasAnswerIndexActions = available.Any(a =>
                string.Equals(a.Type, "answer_quiz", StringComparison.OrdinalIgnoreCase) &&
                a.Payload.ValueKind == JsonValueKind.Object &&
                a.Payload.TryGetProperty("answerIndex", out var node) &&
                node.ValueKind == JsonValueKind.Number);

            action = hasAnswerIndexActions
                ? new GameClientAction(type: "answer_quiz", payload: new { answerIndex = index })
                : new GameClientAction(type: "answer_quiz", payload: new { answer });

            return true;
        }

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

    private static bool TryBuildActionFromServerChoiceActions(
        GamePendingDto pending,
        int choiceIndex,
        out GameClientAction? action)
    {
        action = null;

        if (pending == null || choiceIndex < 0)
        {
            return false;
        }

        if (pending.Data.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!pending.Data.TryGetProperty("choiceActionsByIndex", out var actions) ||
            actions.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        if (choiceIndex >= actions.GetArrayLength())
        {
            return false;
        }

        var node = actions[choiceIndex];
        if (node.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var type = node.TryGetProperty("type", out var typeNode) && typeNode.ValueKind == JsonValueKind.String
            ? (typeNode.GetString() ?? string.Empty).Trim()
            : string.Empty;
        if (type.Length == 0)
        {
            return false;
        }

        object? payload = null;
        if (node.TryGetProperty("payload", out var payloadNode) &&
            payloadNode.ValueKind != JsonValueKind.Undefined &&
            payloadNode.ValueKind != JsonValueKind.Null)
        {
            // Detach from the original JsonDocument to avoid lifetime issues.
            payload = JsonNode.Parse(payloadNode.GetRawText());
        }

        object? meta = null;
        if (node.TryGetProperty("meta", out var metaNode) &&
            metaNode.ValueKind != JsonValueKind.Undefined &&
            metaNode.ValueKind != JsonValueKind.Null)
        {
            meta = JsonNode.Parse(metaNode.GetRawText());
        }

        action = new GameClientAction(type, payload, meta);
        return true;
    }

    private static bool TryBuildMovePawnFromPendingData(
        GamePendingDto pending,
        int choiceIndex,
        List<GameAvailableActionDto> available,
        out GameClientAction? action)
    {
        action = null;

        if (choiceIndex < 0)
        {
            return false;
        }

        if (pending.Data.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!pending.Data.TryGetProperty("moves", out var moves) || moves.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        if (choiceIndex >= moves.GetArrayLength())
        {
            return false;
        }

        var move = moves[choiceIndex];
        if (move.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!JsonPayloadReader.TryReadInt(move, "pawnIndex", out var pawnIndex))
        {
            return false;
        }

        if (!JsonPayloadReader.TryReadInt(move, "targetProgress", out var targetProgress))
        {
            return false;
        }

        var type = available
                       .FirstOrDefault(a => string.Equals(a.Type, "move_pawn", StringComparison.OrdinalIgnoreCase))
                       ?.Type
                   ?? "move_pawn";

        action = new GameClientAction(type: type, payload: new { pawnIndex, targetProgress });
        return true;
    }

    private static bool TryBuildChoosePawnFromPendingData(
        GamePendingDto pending,
        string selectedChoice,
        int choiceIndex,
        List<GameAvailableActionDto> available,
        out GameClientAction? action)
    {
        action = null;

        if (choiceIndex < 0 && string.IsNullOrWhiteSpace(selectedChoice))
        {
            return false;
        }

        if (pending.Data.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!pending.Data.TryGetProperty("pawns", out var pawns) || pawns.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        JsonElement pawn;
        if (choiceIndex >= 0 && choiceIndex < pawns.GetArrayLength())
        {
            pawn = pawns[choiceIndex];
        }
        else
        {
            // Defensive: the displayed list may not be a strict 1:1 mirror of raw server `pending.choices`
            // (a11y distinct, whitespace filtering, etc.). Fall back to matching by label text.
            var wanted = NormalizeChoiceForServer(selectedChoice);
            if (wanted.Length == 0)
            {
                return false;
            }

            pawn = default;
            var found = false;
            foreach (var entry in pawns.EnumerateArray())
            {
                if (entry.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var label = JsonPayloadReader.TryReadString(entry, "label")
                            ?? PawnPayloadReader.TryReadPawnId(entry);
                var description = JsonPayloadReader.TryReadString(entry, "description");
                if (string.IsNullOrWhiteSpace(label))
                {
                    continue;
                }

                var candidate = label.Trim();
                if (!string.IsNullOrWhiteSpace(description))
                {
                    candidate = $"{candidate} - {description.Trim()}";
                }

                if (string.Equals(NormalizeChoiceForServer(candidate), wanted, StringComparison.Ordinal))
                {
                    pawn = entry;
                    found = true;
                    break;
                }
            }

            if (!found)
            {
                return false;
            }
        }

        if (pawn.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var pawnId = PawnPayloadReader.TryReadPawnId(pawn);
        if (string.IsNullOrWhiteSpace(pawnId))
        {
            return false;
        }
        pawnId = pawnId.Trim();

        var matched = available.FirstOrDefault(a =>
        {
            if (!PawnPendingTypes.IsPawnPendingType(a.Type))
            {
                return false;
            }

            if (a.Payload.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var payloadPawnId = PawnPayloadReader.TryReadPawnId(a.Payload);
            return !string.IsNullOrWhiteSpace(payloadPawnId) &&
                   string.Equals(payloadPawnId.Trim(), pawnId, StringComparison.OrdinalIgnoreCase);
        });

        if (!string.IsNullOrWhiteSpace(matched?.Type))
        {
            action = new GameClientAction(type: matched!.Type, payload: matched.Payload);
            return true;
        }

        var type = available
                       .FirstOrDefault(a => PawnPendingTypes.IsPawnPendingType(a.Type))
                       ?.Type
                   ?? "choose_pawn";

        action = new GameClientAction(type: type, payload: new { pawnId });
        return true;
    }

    private static List<GameAvailableActionDto> FilterChoiceActions(
        List<GameAvailableActionDto> actions,
        string pendingType)
    {
        if (actions.Count == 0) return new List<GameAvailableActionDto>();

        var normalized = pendingType?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalized == "lama_turn")
        {
            return actions
                // LAMA: pending.choices are the hand (including duplicates) and must align by index.
                // The backend may expose "lama_play" only for playable cards, and "lama_preview" for others,
                // so include both to keep the 1:1 mapping stable.
                .Where(a =>
                    string.Equals(a.Type, "lama_play", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(a.Type, "lama_preview", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        if (normalized == "lama_hand")
        {
            return actions
                .Where(a => string.Equals(a.Type, "lama_preview", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        if (normalized == "lama_return")
        {
            return actions
                .Where(a => string.Equals(a.Type, "lama_return", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        if (normalized == "lama_setup")
        {
            return actions
                .Where(a => string.Equals(a.Type, "lama_set_target", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
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
                !string.Equals(a.Type, "ROLL_DICE", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(a.Type, "roll_dice", StringComparison.OrdinalIgnoreCase))
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
