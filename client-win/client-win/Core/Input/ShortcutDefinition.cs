using System;
using System.Windows.Input;

namespace client_win.Core.Input;

public sealed class ShortcutDefinition
{
    public ShortcutDefinition(
        KeyGesture gesture,
        ICommand command,
        object? commandParameter = null,
        string? description = null,
        string? code = null,
        bool availableInGame = false)
    {
        Gesture = gesture ?? throw new ArgumentNullException(nameof(gesture));
        Command = command ?? throw new ArgumentNullException(nameof(command));
        CommandParameter = commandParameter;
        Description = description;
        Code = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
        AvailableInGame = availableInGame;
    }

    public ShortcutDefinition(
        char key,
        ICommand command,
        object? commandParameter = null,
        string? description = null,
        string? code = null,
        bool availableInGame = false)
    {
        if (key == '\0') throw new ArgumentException("Key must be a non-null character.", nameof(key));
        Key = key;
        Command = command ?? throw new ArgumentNullException(nameof(command));
        CommandParameter = commandParameter;
        Description = description;
        Code = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
        AvailableInGame = availableInGame;
    }

    public KeyGesture? Gesture { get; }
    public char? Key { get; }
    public ICommand Command { get; }
    public object? CommandParameter { get; }
    public string? Description { get; }
    public string? Code { get; }
    public bool AvailableInGame { get; }
}
