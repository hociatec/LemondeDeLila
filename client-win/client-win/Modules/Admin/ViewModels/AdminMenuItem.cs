namespace client_win.Modules.Admin.ViewModels;

public sealed class AdminMenuItem
{
    public AdminMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }
    public object? Tag { get; }

    public override string ToString() => Label;
}

