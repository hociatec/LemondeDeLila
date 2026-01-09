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
    private readonly ShortcutDefinitionUpserter _upserter;
    private readonly ICommand _drawCommand;
    private readonly ICommand _discardSelectCommand;
    private readonly ICommand _askCardSelectCommand;
    private readonly ICommand _simpleActionCommand;

    internal GamePlayGameShortcutsController(
        ObservableCollection<ShortcutDefinition> shortcuts,
        ICommand drawCommand,
        ICommand discardSelectCommand,
        ICommand askCardSelectCommand,
        ICommand simpleActionCommand)
    {
        _upserter = new ShortcutDefinitionUpserter(shortcuts);
        _drawCommand = drawCommand ?? throw new ArgumentNullException(nameof(drawCommand));
        _discardSelectCommand = discardSelectCommand ?? throw new ArgumentNullException(nameof(discardSelectCommand));
        _askCardSelectCommand = askCardSelectCommand ?? throw new ArgumentNullException(nameof(askCardSelectCommand));
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

        var askKey = ShortcutHintKeyParser.FindActionShortcutKey(state, "ask_card");
        SyncCharShortcut(
            supported: askKey != null && canStartAskCardSelection(state),
            code: "game.ask.select",
            key: askKey,
            command: _askCardSelectCommand,
            description: "Demander une carte (choisir cible + carte)");

        SyncActionShortcutsFromHints(state);
    }

    private void SyncGestureShortcut(
        bool supported,
        string code,
        KeyGesture gesture,
        ICommand command,
        string description)
    {
        _upserter.UpsertOrRemove(
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
        _upserter.UpsertOrRemove(
            code: code,
            supported: supported,
            create: () => new ShortcutDefinition(
                key!.Value,
                command,
                description: description,
                code: code,
                availableInGame: true));
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

            var actionType = hint.ActionType ?? string.Empty;
            if (string.IsNullOrWhiteSpace(actionType))
            {
                continue;
            }

            var shortcutKey = char.ToLowerInvariant(key[0]);
            var code = $"game.action.{actionType}".Trim().ToLowerInvariant();

            _upserter.UpsertOrRemove(
                code: code,
                supported: HasAction(state, actionType),
                create: () => new ShortcutDefinition(
                    key: shortcutKey,
                    command: _simpleActionCommand,
                    commandParameter: actionType,
                    description: $"Action: {actionType}",
                    code: code,
                    availableInGame: true));
        }
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

}
