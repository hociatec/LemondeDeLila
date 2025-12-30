namespace client_win.Modules.About.ViewModels;

public sealed class AboutMenuItem
{
    public AboutMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }

    public object? Tag { get; }
}

