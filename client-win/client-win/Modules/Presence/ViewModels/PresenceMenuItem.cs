namespace client_win.Modules.Presence.ViewModels;

public sealed class PresenceMenuItem
{
    public PresenceMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }

    public object? Tag { get; }
}

