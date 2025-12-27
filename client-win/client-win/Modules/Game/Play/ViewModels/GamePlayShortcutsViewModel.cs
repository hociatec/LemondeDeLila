using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows.Input;
using client_win.Core.Input;
using client_win.Modules.Game.Play.Dtos;
using client_win.Modules.Game.Play.Services;

namespace client_win.Modules.Game.Play.ViewModels;

internal sealed class GamePlayShortcutsViewModel
{
    private readonly GamePlayStateProjector _projector;

    private readonly ICommand _toggleShopping;
    private readonly ICommand _toggleStable;
    private readonly ICommand _toggleScore;
    private readonly ICommand _toggleBasket;
    private readonly ICommand _toggleInventory;
    private readonly ICommand _toggleHand;
    private readonly ICommand _toggleBooks;
    private readonly ICommand _position;

    public GamePlayShortcutsViewModel(
        GamePlayStateProjector projector,
        ICommand toggleShopping,
        ICommand toggleStable,
        ICommand toggleScore,
        ICommand toggleBasket,
        ICommand toggleInventory,
        ICommand toggleHand,
        ICommand toggleBooks,
        ICommand position)
    {
        _projector = projector ?? throw new ArgumentNullException(nameof(projector));
        _toggleShopping = toggleShopping ?? throw new ArgumentNullException(nameof(toggleShopping));
        _toggleStable = toggleStable ?? throw new ArgumentNullException(nameof(toggleStable));
        _toggleScore = toggleScore ?? throw new ArgumentNullException(nameof(toggleScore));
        _toggleBasket = toggleBasket ?? throw new ArgumentNullException(nameof(toggleBasket));
        _toggleInventory = toggleInventory ?? throw new ArgumentNullException(nameof(toggleInventory));
        _toggleHand = toggleHand ?? throw new ArgumentNullException(nameof(toggleHand));
        _toggleBooks = toggleBooks ?? throw new ArgumentNullException(nameof(toggleBooks));
        _position = position ?? throw new ArgumentNullException(nameof(position));
    }

    public ObservableCollection<ShortcutDefinition> Shortcuts { get; } = new();

    public void InitializeStaticShortcuts(params ShortcutDefinition[] definitions)
    {
        Shortcuts.Clear();
        foreach (var definition in definitions.Where(d => d != null))
        {
            Shortcuts.Add(definition);
        }
    }

    public void SyncInterfaceShortcuts(GameStateDto state)
    {
        // Note: la touche est fournie par le serveur via extras.shortcuts (pressed X).
        // On garde un fallback par défaut si jamais le serveur n'envoie pas la touche.

        // Petits chevaux: 'S' est utilisé pour l'écurie (pions/positions).
        // Si présent, on évite d'afficher d'autres raccourcis en conflit sur 'S' (score/shopping).
        if (_projector.HasInterfaceShortcut(state, "stable"))
        {
            SyncInterfaceShortcut(
                state,
                id: "stable",
                defaultKey: 's',
                command: _toggleStable,
                description: "Écurie / pions",
                code: "ui.stable");

            RemoveShortcutByCode("ui.score");
            RemoveShortcutByCode("ui.shopping");
        }
        else
        {
            RemoveShortcutByCode("ui.stable");

            SyncInterfaceShortcut(
                state,
                id: "score",
                defaultKey: 's',
                command: _toggleScore,
                description: "Score en cours",
                code: "ui.score");

            // Panier Express: 'S' est utilisé pour la shopping list.
            // Si le serveur expose "score", on n'ajoute pas "shopping" (conflit sur 's').
            if (!_projector.HasInterfaceShortcut(state, "score"))
            {
                SyncInterfaceShortcut(
                    state,
                    id: "shopping",
                    defaultKey: 's',
                    command: _toggleShopping,
                    description: "Annoncer shopping list",
                    code: "ui.shopping");
            }
            else
            {
                RemoveShortcutByCode("ui.shopping");
            }
        }

        SyncInterfaceShortcut(
            state,
            id: "basket",
            defaultKey: 'b',
            command: _toggleBasket,
            description: "Annoncer panier",
            code: "ui.basket");

        SyncInterfaceShortcut(
            state,
            id: "inventory",
            defaultKey: 'i',
            command: _toggleInventory,
            description: "Annoncer inventaire",
            code: "ui.inventory");

        SyncInterfaceShortcut(
            state,
            id: "hand",
            defaultKey: 'c',
            command: _toggleHand,
            description: "Annoncer main",
            code: "ui.hand");

        SyncInterfaceShortcut(
            state,
            id: "books",
            defaultKey: 'f',
            command: _toggleBooks,
            description: "Annoncer familles complètes",
            code: "ui.books");

        SyncInterfaceShortcut(
            state,
            id: "position",
            defaultKey: 'p',
            command: _position,
            description: "Position plateau",
            code: "ui.position");
    }

    private void SyncInterfaceShortcut(
        GameStateDto state,
        string id,
        char defaultKey,
        ICommand command,
        string description,
        string code)
    {
        var supported = _projector.HasInterfaceShortcut(state, id);
        if (!supported)
        {
            RemoveShortcutByCode(code);
            return;
        }

        var key = FindInterfaceShortcutKey(state, id) ?? defaultKey;

        var existing = FindShortcutByCode(code);
        if (existing != null && existing.Key.HasValue && existing.Key.Value == key)
        {
            return;
        }

        if (existing != null)
        {
            Shortcuts.Remove(existing);
        }

        Shortcuts.Add(new ShortcutDefinition(
            key,
            command,
            description: description,
            code: code,
            availableInGame: true));
    }

    private ShortcutDefinition? FindShortcutByCode(string code)
    {
        foreach (var shortcut in Shortcuts)
        {
            if (string.Equals(shortcut.Code, code, StringComparison.OrdinalIgnoreCase))
            {
                return shortcut;
            }
        }

        return null;
    }

    private void RemoveShortcutByCode(string code)
    {
        var existing = FindShortcutByCode(code);
        if (existing != null)
        {
            Shortcuts.Remove(existing);
        }
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
}
