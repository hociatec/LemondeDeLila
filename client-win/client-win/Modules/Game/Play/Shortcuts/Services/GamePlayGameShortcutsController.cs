using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows.Input;
using client_win.Core.Input;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Game.Play.State.Services;

namespace client_win.Modules.Game.Play.Shortcuts.Services;

internal sealed class GamePlayGameShortcutsController
{
    private readonly ObservableCollection<ShortcutDefinition> _shortcuts;
    private readonly ICommand _drawCommand;
    private readonly ICommand _discardSelectCommand;
    private readonly ICommand _askCardSelectCommand;
    private readonly ICommand _pollutionCommand;
    private readonly ICommand _simpleActionCommand;

    internal GamePlayGameShortcutsController(
        ObservableCollection<ShortcutDefinition> shortcuts,
        ICommand drawCommand,
        ICommand discardSelectCommand,
        ICommand askCardSelectCommand,
        ICommand pollutionCommand,
        ICommand simpleActionCommand)
    {
        _shortcuts = shortcuts ?? throw new ArgumentNullException(nameof(shortcuts));
        _drawCommand = drawCommand ?? throw new ArgumentNullException(nameof(drawCommand));
        _discardSelectCommand = discardSelectCommand ?? throw new ArgumentNullException(nameof(discardSelectCommand));
        _askCardSelectCommand = askCardSelectCommand ?? throw new ArgumentNullException(nameof(askCardSelectCommand));
        _pollutionCommand = pollutionCommand ?? throw new ArgumentNullException(nameof(pollutionCommand));
        _simpleActionCommand = simpleActionCommand ?? throw new ArgumentNullException(nameof(simpleActionCommand));
    }

    internal void Sync(GameStateDto state, Func<GameStateDto, bool> canStartAskCardSelection)
    {
        if (state == null)
        {
            return;
        }

        SyncGestureShortcut(
            supported: HasAction(state, "draw"),
            code: "game.draw",
            gesture: new KeyGesture(Key.Space),
            command: _drawCommand,
            description: "Piocher (draw)");

        SyncGestureShortcut(
            supported: HasDiscardChoices(state),
            code: "game.discard.select",
            gesture: new KeyGesture(Key.Back),
            command: _discardSelectCommand,
            description: "Défausser (choisir une carte)");

        var askKey = FindActionShortcutKey(state, "ask_card");
        SyncCharShortcut(
            supported: askKey != null && canStartAskCardSelection(state),
            code: "game.ask.select",
            key: askKey,
            command: _askCardSelectCommand,
            description: "Demander une carte (choisir cible + carte)");

        // Dame Nature: pollution (exposée dans metadata).
        var pollutionKey = FindInterfaceShortcutKey(state, "pollution") ?? 's';
        SyncCharShortcut(
            supported: HasPollution(state),
            code: "ui.pollution",
            key: pollutionKey,
            command: _pollutionCommand,
            description: "Pollution");

        SyncActionShortcutsFromHints(state);
    }

    private void SyncGestureShortcut(
        bool supported,
        string code,
        KeyGesture gesture,
        ICommand command,
        string description)
    {
        UpsertOrRemoveShortcut(
            code: code,
            supported: supported,
            create: () => new ShortcutDefinition(
                gesture,
                command,
                description: description,
                code: code,
                availableInGame: true));
    }

    private void SyncCharShortcut(
        bool supported,
        string code,
        char? key,
        ICommand command,
        string description)
    {
        UpsertOrRemoveShortcut(
            code: code,
            supported: supported,
            create: () => new ShortcutDefinition(
                key!.Value,
                command,
                description: description,
                code: code,
                availableInGame: true));
    }

    private void UpsertOrRemoveShortcut(string code, bool supported, Func<ShortcutDefinition> create)
    {
        ShortcutDefinition? existing = null;
        foreach (var shortcut in _shortcuts)
        {
            if (string.Equals(shortcut.Code, code, StringComparison.OrdinalIgnoreCase))
            {
                existing = shortcut;
                break;
            }
        }

        if (!supported)
        {
            if (existing != null)
            {
                _shortcuts.Remove(existing);
            }
            return;
        }

        if (existing != null)
        {
            return;
        }

        _shortcuts.Add(create());
    }

    private static bool HasDiscardChoices(GameStateDto? state) => GamePlayChoiceBuilder.HasDiscardChoices(state);

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

    private static char? FindActionShortcutKey(GameStateDto state, string actionType)
    {
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "action", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.Equals(hint.ActionType, actionType, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var key = hint.Key ?? string.Empty;
            const string prefix = "pressed ";
            if (key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                key = key.Substring(prefix.Length).Trim();
            }

            if (key.Length == 1 && char.IsLetter(key[0]))
            {
                return char.ToLowerInvariant(key[0]);
            }
        }

        return null;
    }

    private static char? FindInterfaceShortcutKey(GameStateDto state, string id)
    {
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "interface", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.Equals(hint.Id, id, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var key = hint.Key ?? string.Empty;
            const string prefix = "pressed ";
            if (key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                key = key.Substring(prefix.Length).Trim();
            }

            if (key.Length == 1 && char.IsLetter(key[0]))
            {
                return char.ToLowerInvariant(key[0]);
            }
        }

        return null;
    }

    private static bool HasPollution(GameStateDto state)
    {
        try
        {
            if (state.Metadata.ValueKind != System.Text.Json.JsonValueKind.Object)
            {
                return false;
            }

            if (state.Metadata.TryGetProperty("pollution", out _))
            {
                return true;
            }

            return state.Metadata.TryGetProperty("maxPollution", out _);
        }
        catch
        {
            return false;
        }
    }

    private void SyncActionShortcutsFromHints(GameStateDto state)
    {
        var hints = GamePlayExtrasParser.ExtractShortcutHints(state);
        foreach (var hint in hints)
        {
            if (!string.Equals(hint.Type, "action", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var actionType = hint.ActionType;
            if (string.IsNullOrWhiteSpace(actionType))
            {
                continue;
            }

            // Déjà gérés ailleurs (raccourcis statiques ou flows dédiés).
            if (string.Equals(actionType, "roll", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "ROLL_DICE", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "draw", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "ask_card", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "exchange_accept", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "exchange_refuse", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "answer_ask_card_accept", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(actionType, "answer_ask_card_refuse", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var key = hint.Key ?? string.Empty;
            const string prefix = "pressed ";
            if (key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                key = key.Substring(prefix.Length).Trim();
            }

            if (key.Length != 1 || !char.IsLetter(key[0]))
            {
                continue;
            }

            // Ne bind que les actions réellement "simples" (payload vide).
            if (!HasSimpleAction(state, actionType))
            {
                continue;
            }

            var code = $"game.action.{actionType}".Trim();
            UpsertOrRemoveShortcut(
                code: code,
                supported: true,
                create: () => new ShortcutDefinition(
                    char.ToLowerInvariant(key[0]),
                    _simpleActionCommand,
                    commandParameter: actionType,
                    description: $"Action: {actionType}",
                    code: code,
                    availableInGame: true));
        }
    }

    private static bool HasSimpleAction(GameStateDto state, string actionType)
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

        foreach (var action in actions)
        {
            if (!string.Equals(action.Type, actionType, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var payload = action.Payload;
            if (payload.ValueKind == System.Text.Json.JsonValueKind.Undefined ||
                payload.ValueKind == System.Text.Json.JsonValueKind.Null)
            {
                return true;
            }

            if (payload.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                return !payload.EnumerateObject().Any();
            }

            return false;
        }

        return false;
    }
}
