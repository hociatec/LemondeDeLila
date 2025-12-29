namespace client_win.Modules.MainMenu.ViewModels;

public sealed class MainMenuItem
{
    public MainMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }
    public object? Tag { get; }

    public override string ToString() => Label;
}

