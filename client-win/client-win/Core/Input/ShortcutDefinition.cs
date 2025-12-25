using System;
using System.Windows.Input;

namespace client_win.Core.Input;

public sealed class ShortcutDefinition
{
    public ShortcutDefinition(KeyGesture gesture, ICommand command, object? commandParameter = null, string? description = null)
    {
        Gesture = gesture ?? throw new ArgumentNullException(nameof(gesture));
        Command = command ?? throw new ArgumentNullException(nameof(command));
        CommandParameter = commandParameter;
        Description = description;
    }

    public ShortcutDefinition(char key, ICommand command, object? commandParameter = null, string? description = null)
    {
        if (key == '\0') throw new ArgumentException("Key must be a non-null character.", nameof(key));
        Key = key;
        Command = command ?? throw new ArgumentNullException(nameof(command));
        CommandParameter = commandParameter;
        Description = description;
    }

    public KeyGesture? Gesture { get; }
    public char? Key { get; }
    public ICommand Command { get; }
    public object? CommandParameter { get; }
    public string? Description { get; }
}
